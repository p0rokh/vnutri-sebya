"""Запуск: python3 -m unittest discover -s server -v  (из корня репо)."""
import json
import os
import re
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import app

HERE = os.path.dirname(os.path.abspath(__file__))


def valid_payload(id_="a" * 32, q33=None):
    answers = {"q%d" % i: 0 for i in app.FLOW_IDS}
    return {"id": id_, "version": "2", "answers": answers, "q33": q33,
            "R": 1.0, "level": "low", "F": {"F1": 1, "F2": 1, "F3": 1, "F4": 1}}


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.server = app.make_server(os.path.join(cls.tmp.name, "t.db"), "127.0.0.1", 0,
                                     allowed_origins=["https://example.test"])
        cls.base = "http://127.0.0.1:%d" % cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def req(self, method, path, body=None, headers=None, raw=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        h = {"Content-Type": "application/json"} if data is not None else {}
        h.update(headers or {})
        r = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=5) as resp:
                return resp.status, resp.read(), dict(resp.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), dict(e.headers)

    def test_post_then_rating_then_noop(self):
        s, b, _ = self.req("POST", "/api/results", valid_payload("b" * 32))
        self.assertEqual(s, 201, b)
        s, _, _ = self.req("POST", "/api/results", valid_payload("b" * 32, q33=1))
        self.assertEqual(s, 200)
        s, _, _ = self.req("POST", "/api/results", valid_payload("b" * 32, q33=4))
        self.assertEqual(s, 200)
        _, body, _ = self.req("GET", "/api/stats")
        row = [r for r in json.loads(body)["rows"] if r["id"] == "b" * 32][0]
        self.assertEqual(row["q33"], 1, "оценка проставляется ровно один раз")
        self.assertIsNotNone(row["rated_at"])

    def test_validation(self):
        bad = valid_payload("c" * 32); bad["answers"]["q5"] = 5
        self.assertEqual(self.req("POST", "/api/results", bad)[0], 400)
        bad = valid_payload("c" * 32); bad["answers"]["q17"] = 5    # «не отвечать» — ок
        self.assertEqual(self.req("POST", "/api/results", bad)[0], 201)
        bad = valid_payload("d" * 32); bad["extra"] = 1
        self.assertEqual(self.req("POST", "/api/results", bad)[0], 400)
        bad = valid_payload("d" * 32); del bad["answers"]["q1"]
        self.assertEqual(self.req("POST", "/api/results", bad)[0], 400)
        bad = valid_payload("d" * 32); bad["R"] = 7
        self.assertEqual(self.req("POST", "/api/results", bad)[0], 400)
        bad = valid_payload("d" * 32); bad["answers"]["q3"] = True
        self.assertEqual(self.req("POST", "/api/results", bad)[0], 400)
        self.assertEqual(self.req("POST", "/api/results", raw=b"{not json", headers={"Content-Type": "application/json"})[0], 400)

    def test_protocol_errors(self):
        self.assertEqual(self.req("POST", "/api/results", raw=b"{}", headers={"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.req("POST", "/api/results", raw=b"x" * 9000)[0], 413)
        self.assertEqual(self.req("POST", "/api/other", valid_payload())[0], 404)
        self.assertEqual(self.req("PUT", "/api/results", valid_payload())[0], 405)
        self.assertEqual(self.req("POST", "/api/results", valid_payload("e" * 32), headers={"Origin": "https://evil.test"})[0], 403)
        self.assertEqual(self.req("POST", "/api/results", valid_payload("e" * 32), headers={"Origin": "https://example.test"})[0], 201)

    def test_stats_and_csv(self):
        self.req("POST", "/api/results", valid_payload("f" * 32, q33=0))
        s, body, _ = self.req("GET", "/api/stats")
        data = json.loads(body)
        self.assertEqual(s, 200)
        self.assertEqual(data["count"], len(data["rows"]))
        s, body, h = self.req("GET", "/api/export.csv")
        self.assertEqual(s, 200)
        self.assertTrue(body.startswith("﻿".encode("utf-8")))
        head = body.decode("utf-8-sig").split("\r\n")[0]
        self.assertEqual(head.split(";")[:3], ["id", "created_at", "version"])
        self.assertTrue(head.endswith("created_at_msk"))
        self.assertIn("attachment", h.get("Content-Disposition", ""))
        self.assertEqual(self.req("GET", "/api/health")[0], 200)

    def test_delete_one_and_all(self):
        self.req("POST", "/api/results", valid_payload("1" * 32))
        self.req("POST", "/api/results", valid_payload("2" * 32))
        s, body, _ = self.req("DELETE", "/api/admin/results/" + "1" * 32)
        self.assertEqual((s, json.loads(body)["deleted"]), (200, 1))
        s, body, _ = self.req("DELETE", "/api/admin/results/" + "1" * 32)
        self.assertEqual(json.loads(body)["deleted"], 0)
        self.assertEqual(self.req("DELETE", "/api/admin/results/zzz")[0], 404)
        self.assertEqual(self.req("DELETE", "/api/results")[0], 404, "открытый путь удалять не умеет")
        s, body, _ = self.req("DELETE", "/api/admin/results")
        self.assertEqual(s, 200)
        self.assertEqual(json.loads(self.req("GET", "/api/stats")[1])["count"], 0)

    def test_concurrent_posts(self):
        with ThreadPoolExecutor(max_workers=10) as ex:
            codes = list(ex.map(lambda i: self.req("POST", "/api/results", valid_payload("%032x" % (0xA000 + i)))[0], range(20)))
        self.assertEqual(codes, [201] * 20)

    def test_option_counts_match_quiz_js(self):
        """Число вариантов в OPTION_COUNTS совпадает с моделью site/js/quiz.js."""
        src = open(os.path.join(HERE, "..", "site", "js", "quiz.js"), encoding="utf-8").read()
        scale = len(re.findall(r"\{ value: \d, label:", src.split("var SCALE_DEFAULT")[1].split("];")[0]))
        self.assertEqual(scale, 5)
        # Вопросы с явными options: считаем элементы в их массиве
        for m in re.finditer(r"\{ id: (\d+),[^\[\}]*?options: \[(.*?)\] \}", src, re.S):
            qid, block = int(m.group(1)), m.group(2)
            n = len(re.findall(r"\{ (?:value|label)|OPT_(?:DECLINE|UNSURE)", block))
            self.assertEqual(n, app.OPTION_COUNTS[qid], "q%d" % qid)
        for qid in range(17, 22):
            self.assertIn("id: %d, section: 2, factor: \"F%d\", text: \"" % (qid, 3 if qid == 17 else 4), src)
            self.assertEqual(app.OPTION_COUNTS[qid], scale + 1)
        self.assertEqual(sum(1 for qid in range(3, 29) if qid not in range(17, 22) and app.OPTION_COUNTS[qid] == scale), 21)


if __name__ == "__main__":
    unittest.main()
