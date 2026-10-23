# server/ — API сбора результатов

Один файл `app.py`, только стандартная библиотека Python 3 (http.server + sqlite3).

```bash
# локально
VS_DB=/tmp/vs.db python3 server/app.py          # http://127.0.0.1:8765
curl -s 127.0.0.1:8765/api/health

# тесты (из корня репо)
python3 -m unittest discover -s server -v
```

Переменные окружения: `VS_HOST` (127.0.0.1), `VS_PORT` (8765), `VS_DB` (путь к SQLite),
`VS_ORIGINS` (список разрешённых Origin через запятую; пусто — не проверять).

Остальные файлы — конфиги для сервера, копируются руками по `docs/Деплой.md`:
`vnutri-sebya-api.service` (systemd), `nginx-api.conf` (snippet с location'ами),
`nginx-limits.conf` (limit_req_zone).
