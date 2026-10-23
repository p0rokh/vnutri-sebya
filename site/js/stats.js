"use strict";
/*
 * Служебная статистика: берёт сырые строки из /api/stats (за basic auth),
 * подписи вариантов — из модели quiz.js. Всё считается в браузере.
 */
(function () {
  var root = document.getElementById("s-root");
  var meta = document.getElementById("s-meta");
  var LEVEL_LABEL = { low: "Низкий", medium: "Средний", high: "Высокий" };
  var FACTOR_LABEL = { F1: "F1 · Когнитивные установки", F2: "F2 · Образ тела", F3: "F3 · Пищевое поведение", F4: "F4 · Внешние факторы" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pct(n, total) { return total ? Math.round(n / total * 100) : 0; }
  function optLabel(qid, idx) {
    var q = QUESTIONS.filter(function (x) { return x.id === qid; })[0];
    var o = optionsFor(q)[idx];
    return o ? o.label.replace("Предпочитаю не отвечать", "—") : "?";
  }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("ru-RU"); } catch (e) { return iso; } }

  // Распределение: items = [{label, n, code?}]
  function dist(items, total) {
    return '<div class="dist">' + items.map(function (it) {
      return '<span class="lbl">' + esc(it.label) + "</span>" +
        '<span class="bar' + (it.code ? " code" : "") + '"><i style="width:' + pct(it.n, total) + '%"></i></span>' +
        '<span class="n">' + it.n + " · " + pct(it.n, total) + "%</span>";
    }).join("") + "</div>";
  }

  function questionDist(q, rows) {
    var opts = optionsFor(q), counts = opts.map(function () { return 0; }), missing = 0;
    rows.forEach(function (r) {
      var v = r["q" + q.id];
      if (v === null || v === undefined) missing++; else counts[v] = (counts[v] || 0) + 1;
    });
    var items = opts.map(function (o, i) { return { label: o.label, n: counts[i], code: typeof o.value !== "number" }; });
    if (missing) items.push({ label: "Без ответа", n: missing, code: true });
    var answered = rows.length;
    var scored = rows.filter(function (r) { var o = opts[r["q" + q.id]]; return o && typeof o.value === "number"; });
    var mean = scored.length ? (scored.reduce(function (a, r) { return a + opts[r["q" + q.id]].value; }, 0) / scored.length).toFixed(2) : "—";
    return '<div class="qcard"><h3>' + q.id + ". " + esc(q.text) + "</h3>" +
      (q.factor ? '<p class="muted" style="font-size:13px;margin:-4px 0 10px">' + q.factor + " · средний балл " + mean + " (по " + scored.length + " отвеченным)</p>" : "") +
      dist(items, answered) + "</div>";
  }

  function crossTab(rows) {
    var q32 = QUESTIONS.filter(function (q) { return q.id === 32; })[0];
    var opts = optionsFor(q32), levels = ["low", "medium", "high"];
    var html = '<table class="x"><tr><th>Диагноз (q32) \\ уровень</th>' + levels.map(function (l) { return "<th>" + LEVEL_LABEL[l] + "</th>"; }).join("") + "<th>Всего</th></tr>";
    opts.forEach(function (o, i) {
      var sub = rows.filter(function (r) { return r.q32 === i; });
      html += "<tr><td>" + esc(o.label) + "</td>" + levels.map(function (l) {
        return "<td>" + sub.filter(function (r) { return r.level === l; }).length + "</td>";
      }).join("") + "<td>" + sub.length + "</td></tr>";
    });
    return html + "</table>";
  }

  function render(data) {
    var rows = data.rows, n = rows.length;
    meta.textContent = n ? ("Ответов: " + n + " · первый " + fmtDate(rows[0].created_at) + " · последний " + fmtDate(rows[n - 1].created_at) + " · сформировано " + fmtDate(data.generated_at)) : "Ответов пока нет.";
    if (!n) { root.innerHTML = ""; return; }

    var byLevel = { low: 0, medium: 0, high: 0 };
    rows.forEach(function (r) { byLevel[r.level]++; });
    var rated = rows.filter(function (r) { return r.q33 !== null; }).length;
    var mean = function (k) { return (rows.reduce(function (a, r) { return a + r[k]; }, 0) / n).toFixed(2); };
    var last7 = rows.filter(function (r) { return Date.now() - new Date(r.created_at).getTime() < 7 * 864e5; }).length;

    var html = '<div class="tiles">' +
      '<div class="tile"><b>' + n + "</b><span>всего ответов</span></div>" +
      '<div class="tile"><b>' + last7 + "</b><span>за последние 7 дней</span></div>" +
      '<div class="tile"><b class="lvl-low">' + byLevel.low + "</b><span>низкий риск · " + pct(byLevel.low, n) + "%</span></div>" +
      '<div class="tile"><b class="lvl-medium">' + byLevel.medium + "</b><span>средний риск · " + pct(byLevel.medium, n) + "%</span></div>" +
      '<div class="tile"><b class="lvl-high">' + byLevel.high + "</b><span>высокий риск · " + pct(byLevel.high, n) + "%</span></div>" +
      '<div class="tile"><b>' + mean("r") + "</b><span>средний R (из 5)</span></div>" +
      '<div class="tile"><b>' + rated + "</b><span>оценили проект · " + pct(rated, n) + "%</span></div>" +
      "</div>";

    html += '<h2 id="s-list">Все записи <span class="muted" style="font-weight:400;font-size:15px">(' + n + ")</span></h2>" +
      '<div class="toolbar" style="margin:0 0 10px"><button class="btn btn--secondary btn--danger" type="button" data-del-all="1">Удалить все записи</button></div>' +
      '<div style="overflow-x:auto"><table class="x"><tr><th>Когда</th><th>R</th><th>Уровень</th><th>F1</th><th>F2</th><th>F3</th><th>F4</th><th>Пол</th><th>Возраст</th><th>q33</th><th></th></tr>' +
      rows.slice().reverse().map(function (r) {
        return '<tr data-row="' + r.id + '"><td>' + fmtDate(r.created_at) + "</td><td>" + r.r.toFixed(2) + '</td><td class="lvl-' + r.level + '">' + LEVEL_LABEL[r.level] + "</td>" +
          ["f1", "f2", "f3", "f4"].map(function (k) { return "<td>" + r[k].toFixed(2) + "</td>"; }).join("") +
          "<td>" + esc(optLabel(1, r.q1)) + "</td><td>" + esc(optLabel(2, r.q2)) + "</td>" +
          "<td>" + (r.q33 === null ? "—" : r.q33 + 1) + "</td>" +
          '<td><button class="btn-x" type="button" data-del="' + r.id + '" title="Удалить запись">Удалить</button></td></tr>';
      }).join("") + "</table></div>";

    html += "<h2>Средние по факторам (из 5)</h2>" + '<div class="dist">' + ["f1", "f2", "f3", "f4"].map(function (k) {
      var m = mean(k);
      return '<span class="lbl">' + FACTOR_LABEL[k.toUpperCase()] + "</span>" +
        '<span class="bar"><i style="width:' + (m / 5 * 100) + '%"></i></span><span class="n">' + m + "</span>";
    }).join("") + "</div>";

    html += "<h2>Кто отвечал</h2>" + [1, 2].map(function (id) {
      return questionDist(QUESTIONS.filter(function (q) { return q.id === id; })[0], rows);
    }).join("");

    html += "<h2>Диагноз и уровень риска</h2>" + crossTab(rows);

    html += "<h2>Оценка проекта (q33)</h2>" + questionDist(RATING_QUESTION, rows);

    html += "<h2>Ответы по каждому вопросу</h2>" + QUESTIONS.filter(function (q) { return q.id >= 3 && q.id <= 32; }).map(function (q) {
      return questionDist(q, rows);
    }).join("");

    root.innerHTML = html;
  }

  function load() {
    meta.textContent = "Загружаю…";
    fetch("/api/stats", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(render).catch(function (e) {
      meta.textContent = "";
      root.innerHTML = '<div class="err">Не удалось загрузить данные: ' + esc(e.message) + ". Страница работает только на сервере за паролем.</div>";
    });
  }
  // Удаление: первый клик — спрашиваем прямо в кнопке, второй — удаляем
  function armButton(btn, text, onConfirm) {
    if (btn.getAttribute("data-armed")) { onConfirm(); return; }
    var old = btn.textContent;
    btn.setAttribute("data-armed", "1");
    btn.textContent = text;
    btn.classList.add("is-armed");
    setTimeout(function () {
      btn.removeAttribute("data-armed"); btn.textContent = old; btn.classList.remove("is-armed");
    }, 4000);
  }
  function del(path, done) {
    fetch(path, { method: "DELETE", cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(done).catch(function (e) { alertBox("Не удалось удалить: " + e.message); });
  }
  function alertBox(msg) {
    var box = document.createElement("div");
    box.className = "err"; box.textContent = msg; box.style.marginTop = "12px";
    root.insertBefore(box, root.firstChild);
    setTimeout(function () { box.remove(); }, 6000);
  }
  root.addEventListener("click", function (e) {
    var one = e.target.closest("[data-del]");
    var all = e.target.closest("[data-del-all]");
    if (one) {
      armButton(one, "Точно?", function () {
        del("/api/admin/results/" + one.getAttribute("data-del"), load);
      });
    } else if (all) {
      armButton(all, "Точно удалить ВСЕ записи? Нажми ещё раз", function () {
        del("/api/admin/results", load);
      });
    }
  });
  document.getElementById("s-reload").addEventListener("click", load);
  load();
})();
