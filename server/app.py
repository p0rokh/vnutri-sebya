#!/usr/bin/env python3
"""API сбора анонимных результатов теста «Внутри себя». Только stdlib.

POST /api/results   — открытый (за nginx limit_req): идемпотентный upsert по клиентскому id
GET  /api/stats     — сырые строки JSON (за nginx basic auth)
GET  /api/export.csv— CSV для Excel (за nginx basic auth)
DELETE /api/admin/results/<id> — удалить одну запись (за nginx basic auth)
DELETE /api/admin/results      — удалить все записи (за nginx basic auth)
GET  /api/health    — только локально

Не хранит IP, User-Agent и прочие заголовки. См. docs/Деплой.md.
"""
import csv
import io
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Число вариантов у каждого вопроса — осознанный дубль site/js/quiz.js (сверяется тестом).
OPTION_COUNTS = {1: 4, 2: 5}
OPTION_COUNTS.update({i: 5 for i in range(3, 17)})     # шкала 1–5
OPTION_COUNTS.update({i: 6 for i in range(17, 22)})    # шкала + «не отвечать»
OPTION_COUNTS.update({i: 5 for i in range(22, 29)})
OPTION_COUNTS.update({29: 4, 30: 5, 31: 6, 32: 6, 33: 6})
FLOW_IDS = list(range(1, 33))          # отвечают до результата
RATING_ID = 33                         # оценка проекта, может быть null
LEVELS = ("low", "medium", "high")
FACTORS = ("F1", "F2", "F3", "F4")
MAX_BODY = 8192
ID_RE = re.compile(r"^[0-9a-f]{32}$")
VERSION_RE = re.compile(r"^[0-9A-Za-z._-]{1,32}$")

Q_COLS = ["q%d" % i for i in FLOW_IDS]
COLUMNS = ["id", "created_at", "version"] + Q_COLS + ["q33", "rated_at", "r", "level", "f1", "f2", "f3", "f4"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS results (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  version    TEXT NOT NULL,
  %s,
  q33        INTEGER,
  rated_at   TEXT,
  r          REAL NOT NULL,
  level      TEXT NOT NULL CHECK (level IN ('low','medium','high')),
  f1 REAL NOT NULL, f2 REAL NOT NULL, f3 REAL NOT NULL, f4 REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS results_created_at ON results(created_at);
""" % ",\n  ".join("%s INTEGER NOT NULL" % c for c in Q_COLS)

UPSERT = """
INSERT INTO results (%s) VALUES (%s)
ON CONFLICT(id) DO UPDATE SET q33 = excluded.q33, rated_at = excluded.rated_at
  WHERE results.q33 IS NULL AND excluded.q33 IS NOT NULL
""" % (", ".join(COLUMNS), ", ".join(":" + c for c in COLUMNS))

MSK = timezone(timedelta(hours=3), "MSK")


def now_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def init_db(path):
    conn = sqlite3.connect(path)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        conn.execute("PRAGMA user_version=1")
        conn.commit()
    finally:
        conn.close()


def connect(path):
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _index(v, qid):
    if not _is_int(v) or not (0 <= v < OPTION_COUNTS[qid]):
        raise ValueError("q%d: недопустимый индекс варианта" % qid)
    return v


def validate(payload):
    """Проверяет тело POST и возвращает строку для БД. ValueError — ответ 400."""
    if not isinstance(payload, dict):
        raise ValueError("тело должно быть объектом")
    expected = {"id", "version", "answers", "q33", "R", "level", "F"}
    if set(payload) != expected:
        raise ValueError("ожидаются ключи: " + ", ".join(sorted(expected)))
    if not isinstance(payload["id"], str) or not ID_RE.match(payload["id"]):
        raise ValueError("id: 32 hex-символа")
    if not isinstance(payload["version"], str) or not VERSION_RE.match(payload["version"]):
        raise ValueError("version: недопустимое значение")
    answers = payload["answers"]
    if not isinstance(answers, dict) or set(answers) != set(Q_COLS):
        raise ValueError("answers: ожидаются ключи q1..q32")
    row = {"id": payload["id"], "version": payload["version"], "created_at": now_utc()}
    for qid in FLOW_IDS:
        row["q%d" % qid] = _index(answers["q%d" % qid], qid)
    q33 = payload["q33"]
    row["q33"] = None if q33 is None else _index(q33, RATING_ID)
    row["rated_at"] = None if q33 is None else row["created_at"]
    if not _is_num(payload["R"]) or not (1 <= payload["R"] <= 5):
        raise ValueError("R: число в [1; 5]")
    row["r"] = float(payload["R"])
    if payload["level"] not in LEVELS:
        raise ValueError("level: low | medium | high")
    row["level"] = payload["level"]
    F = payload["F"]
    if not isinstance(F, dict) or set(F) != set(FACTORS):
        raise ValueError("F: ожидаются ключи F1..F4")
    for f in FACTORS:
        if not _is_num(F[f]) or not (1 <= F[f] <= 5):
            raise ValueError("%s: число в [1; 5]" % f)
        row[f.lower()] = float(F[f])
    return row


def upsert(conn, row):
    """Возвращает 201 для новой строки, 200 для повтора (q33 проставлен или no-op)."""
    with conn:
        exists = conn.execute("SELECT 1 FROM results WHERE id = ?", (row["id"],)).fetchone()
        conn.execute(UPSERT, row)
    return 200 if exists else 201


def all_rows(conn):
    cur = conn.execute("SELECT %s FROM results ORDER BY created_at, id" % ", ".join(COLUMNS))
    return [dict(zip(COLUMNS, r)) for r in cur.fetchall()]


def to_csv(rows):
    """UTF-8 с BOM, разделитель «;», CRLF — чтобы Excel с русской локалью открыл как есть."""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    w.writerow(COLUMNS + ["created_at_msk"])
    for r in rows:
        utc = datetime.strptime(r["created_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        msk = utc.astimezone(MSK).strftime("%Y-%m-%d %H:%M:%S")
        w.writerow([("" if r[c] is None else r[c]) for c in COLUMNS] + [msk])
    return ("﻿" + buf.getvalue()).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "vnutri-sebya-api"
    sys_version = ""

    # Без адреса клиента: стандартный log_message пишет IP в journald.
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, code, body=b"", ctype="application/json; charset=utf-8", headers=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, code, obj):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            return self._json(200, {"ok": True})
        if path == "/api/stats":
            conn = connect(self.server.db_path)
            try:
                rows = all_rows(conn)
            finally:
                conn.close()
            return self._json(200, {"generated_at": now_utc(), "count": len(rows), "rows": rows})
        if path == "/api/export.csv":
            conn = connect(self.server.db_path)
            try:
                body = to_csv(all_rows(conn))
            finally:
                conn.close()
            name = "results-%s.csv" % datetime.now(timezone.utc).strftime("%Y%m%d")
            return self._send(200, body, "text/csv; charset=utf-8",
                              {"Content-Disposition": 'attachment; filename="%s"' % name})
        return self._json(404, {"error": "not found"})

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/api/results":
            return self._json(404, {"error": "not found"})
        origin = self.headers.get("Origin")
        if origin and self.server.allowed_origins and origin not in self.server.allowed_origins:
            return self._json(403, {"error": "origin"})
        if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
            return self._json(415, {"error": "application/json expected"})
        length = self.headers.get("Content-Length")
        if length is None or not length.isdigit():
            return self._json(411, {"error": "length required"})
        if int(length) > MAX_BODY:
            return self._json(413, {"error": "body too large"})
        try:
            payload = json.loads(self.rfile.read(int(length)).decode("utf-8"))
            row = validate(payload)
        except (ValueError, UnicodeDecodeError) as e:
            return self._json(400, {"error": str(e)})
        try:
            conn = connect(self.server.db_path)
            try:
                code = upsert(conn, row)
            finally:
                conn.close()
        except sqlite3.Error:
            self.log_message("sqlite error on upsert")
            return self._json(500, {"error": "storage"})
        return self._json(code, {"ok": True, "id": row["id"]})

    def do_DELETE(self):
        """Админ-удаление. Доступ ограничивает nginx (basic auth на /api/admin/)."""
        path = self.path.split("?", 1)[0]
        if path == "/api/admin/results":
            sql, args = "DELETE FROM results", ()
        elif path.startswith("/api/admin/results/") and ID_RE.match(path.rsplit("/", 1)[1]):
            sql, args = "DELETE FROM results WHERE id = ?", (path.rsplit("/", 1)[1],)
        else:
            return self._json(404, {"error": "not found"})
        try:
            conn = connect(self.server.db_path)
            try:
                with conn:
                    deleted = conn.execute(sql, args).rowcount
            finally:
                conn.close()
        except sqlite3.Error:
            self.log_message("sqlite error on delete")
            return self._json(500, {"error": "storage"})
        return self._json(200, {"ok": True, "deleted": deleted})

    def do_PUT(self):
        self._json(405, {"error": "method"})

    do_PATCH = do_OPTIONS = do_PUT


def make_server(db_path, host="127.0.0.1", port=0, allowed_origins=()):
    init_db(db_path)
    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    server.db_path = db_path
    server.allowed_origins = set(allowed_origins)
    return server


def main():
    db = os.environ.get("VS_DB", "results.db")
    host = os.environ.get("VS_HOST", "127.0.0.1")
    port = int(os.environ.get("VS_PORT", "8765"))
    origins = [o.strip() for o in os.environ.get("VS_ORIGINS", "").split(",") if o.strip()]
    os.makedirs(os.path.dirname(os.path.abspath(db)), exist_ok=True)
    server = make_server(db, host, port, origins)
    sys.stderr.write("vnutri-sebya-api on %s:%d, db=%s\n" % (host, server.server_address[1], db))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
