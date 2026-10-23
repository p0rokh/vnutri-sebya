"use strict";
/*
 * DOM-механика теста. Все числа модели — в quiz.js (QUESTIONS, SCALE_DEFAULT,
 * WEIGHTS, computeResult); здесь только экраны, рендер и анимации.
 */
(function () {
  var TOTAL = QUESTIONS.length; // вопросов до результата (оценка проекта — отдельно)
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Ответы: Map<id, {i: индекс варианта, score: балл или код}> — индекс нужен,
  // чтобы «Назад» восстанавливал выбор и чтобы отправлять именно индекс.
  var state = { index: 0, answers: new Map(), result: null, rating: null, submissionId: null };

  var els = {
    intro:   document.getElementById("scr-intro"),
    quiz:    document.getElementById("scr-quiz"),
    result:  document.getElementById("scr-result"),
    start:   document.getElementById("q-start"),
    consent: document.getElementById("q-consent"),
    num:     document.getElementById("q-num"),
    total:   document.getElementById("q-total"),
    section: document.getElementById("q-section"),
    fill:    document.getElementById("q-fill"),
    pct:     document.getElementById("q-pct"),
    track:   document.querySelector(".quiz-progress__track"),
    form:    document.getElementById("q-form"),
    text:    document.getElementById("q-text"),
    options: document.getElementById("q-options"),
    back:    document.getElementById("q-back"),
    next:    document.getElementById("q-next"),
    exit:    document.getElementById("q-exit"),
    modal:   document.getElementById("exit-modal"),
    stay:    document.getElementById("exit-stay"),
    rTitle:  document.getElementById("r-title"),
    rSub:    document.getElementById("r-sub"),
    rNote:   document.getElementById("r-note-text"),
    rNum:    document.getElementById("r-num"),
    rBars:   document.getElementById("r-bars"),
    rCards:  document.getElementById("r-cards"),
    rRemember: document.getElementById("r-remember"),
    rContacts: document.getElementById("r-contacts"),
    rRatingText: document.getElementById("r-rating-text"),
    rRatingOptions: document.getElementById("r-rating-options"),
    rRatingThanks: document.getElementById("r-rating-thanks"),
    restart: document.getElementById("q-restart"),
    print:   document.getElementById("q-print")
  };

  // Мини-иконки настроения для шкалы 1–5 (лист → волны → облако → дождь → гроза)
  var MOOD_ICONS = {
    1: '<path d="M13 20 C 8 17, 5.5 12.5, 7 6.5 C 13 6, 18 8.5, 19 14 C 19.7 17.5, 17 19.5, 13 20 Z"/><path d="M9.5 16.5 C 12 14, 14.5 11.5, 17 9.5"/>',
    2: '<path d="M4 9c2.5-2 5.5-2 8 0s5.5 2 8 0"/><path d="M4 14c2.5-2 5.5-2 8 0s5.5 2 8 0"/>',
    3: '<path d="M7 17a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.8-1A4.2 4.2 0 0 1 16.8 17z"/>',
    4: '<path d="M7 14a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.8-1A4.2 4.2 0 0 1 16.8 14z"/><path d="M9 17.5v2M13 17.5v2M17 17.5v2"/>',
    5: '<path d="M7 13a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.8-1A4.2 4.2 0 0 1 16.8 13z"/><path d="M13 13l-2.5 4h3l-2 3.5"/>'
  };

  // Тексты трёх состояний результата (docs/Аналитика.md §5.4)
  var RESULT_TEXTS = {
    low: {
      title: "Низкий уровень риска",
      sub: "Твои ответы не указывают на выраженные признаки расстройств пищевого поведения.",
      note: "Это хороший знак! Тем не менее важно продолжать заботиться о себе, своём теле и эмоциональном состоянии.",
      remember: "Состояние и отношения с едой могут меняться в разные периоды жизни. Если что-то вызывает тревогу, усталость или недовольство собой — это повод прислушаться к себе и при необходимости обратиться за поддержкой.",
      cards: [
        ["У тебя здоровые установки в отношении еды и тела", "Ты стараешься относиться к себе с уважением и вниманием."],
        ["Ты умеешь замечать свои эмоции и потребности", "Это помогает справляться со стрессом и трудностями бережнее."],
        ["Ты можешь поддерживать себя и просить о помощи", "Это важный навык, который делает тебя сильнее."]
      ]
    },
    medium: {
      title: "Средний уровень риска",
      sub: "Некоторые твои ответы указывают на то, что стоит обратить внимание на отношения с едой, телом и своими эмоциями.",
      note: "Это не повод для паники. Это сигнал о том, что забота о себе сейчас особенно важна. Маленькие шаги могут привести к большим изменениям.",
      remember: "Ты не обязан(а) справляться со всем сразу. Достаточно начать с маленьких шагов: наблюдать за собой, быть добрее к себе и обращаться за поддержкой, когда это необходимо.",
      cards: [
        ["Ты можешь испытывать напряжение и тревогу", "Это может проявляться в мыслях о еде, теле, весе или внешности."],
        ["Эмоции могут влиять на твоё поведение", "Стресс, грусть, усталость иногда побуждают к перееданию или ограничениям."],
        ["Важно не оставаться с этим наедине", "Поддержка и внимание к себе помогут улучшить твоё состояние."]
      ]
    },
    high: {
      title: "Высокий уровень риска",
      sub: "Твои ответы указывают на то, что у тебя есть выраженные признаки расстройств пищевого поведения и эмоционального дискомфорта.",
      note: "Это не диагноз, но это важный сигнал: тебе может быть сейчас очень тяжело. Пожалуйста, не оставайся с этим один(на). Поддержка специалиста может значительно помочь.",
      remember: "Многие люди сталкиваются с похожими трудностями и успешно восстанавливаются. Помощь — это не слабость, а забота о себе. Чем раньше ты обратишься за поддержкой, тем легче будет путь к улучшению.",
      cards: [
        ["Тебе может быть трудно справляться в одиночку", "Мысли о еде, теле и весе могут занимать много сил и мешать жить."],
        ["Повышен риск развития РПП", "Важно не игнорировать своё состояние и обратиться за помощью."],
        ["Поддержка может изменить ситуацию к лучшему", "Ты не обязан(а) справляться сам(а). Есть люди, которые хотят и могут помочь."]
      ]
    }
  };

  function currentQuestion() { return QUESTIONS[state.index]; }

  // Разметка вариантов ответа (общая для вопросов и оценки проекта)
  function renderOptions(q, name, savedIndex) {
    var html = "";
    optionsFor(q).forEach(function (opt, i) {
      var icon = typeof opt.value === "number" && MOOD_ICONS[opt.value];
      html +=
        '<label class="option">' +
          '<input type="radio" name="' + name + '" value="' + i + '"' +
            (savedIndex === i ? " checked" : "") + ">" +
          '<span class="option__mark" aria-hidden="true"></span>' +
          '<span class="option__body">' +
            '<span class="option__label">' + opt.label + "</span>" +
            (opt.hint ? '<span class="option__hint">' + opt.hint + "</span>" : "") +
          "</span>" +
          (icon
            ? '<svg class="option__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon + "</svg>"
            : "") +
        "</label>";
    });
    return html;
  }

  function showScreen(el) {
    [els.intro, els.quiz, els.result].forEach(function (s) { s.hidden = (s !== el); });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function updateChecked() {
    var opts = els.options.querySelectorAll(".option");
    opts.forEach(function (o) {
      o.classList.toggle("is-checked", o.querySelector("input").checked);
    });
  }

  function renderQuestion(direction) {
    var q = currentQuestion();
    var n = state.index + 1;
    var pct = Math.round(n / TOTAL * 100);

    els.num.textContent = String(n);
    els.fill.style.width = pct + "%";
    els.pct.textContent = pct + "%";
    els.track.setAttribute("aria-valuenow", String(n));
    els.text.textContent = n + ". " + q.text;
    els.section.textContent = SECTIONS[q.section] || "";

    var saved = state.answers.get(q.id);
    els.options.innerHTML = renderOptions(q, "q" + q.id, saved ? saved.i : -1);
    updateChecked();

    els.next.disabled = !saved;
    els.next.innerHTML = (state.index === TOTAL - 1)
      ? 'Узнать результат <span class="arr">→</span>'
      : 'Далее <span class="arr">→</span>';
    els.back.style.visibility = state.index === 0 ? "hidden" : "visible";

    if (!reduceMotion && direction) {
      var box = els.options;
      box.classList.remove("slide-fwd", "slide-back");
      void box.offsetWidth; /* перезапуск анимации */
      box.classList.add(direction === "back" ? "slide-back" : "slide-fwd");
    }
  }

  function onSelect() {
    var q = currentQuestion();
    var input = els.options.querySelector("input:checked");
    if (!input) return;
    var i = Number(input.value);
    state.answers.set(q.id, { i: i, score: scoreOf(optionsFor(q)[i]) });
    updateChecked();
    els.next.disabled = false;
  }

  function next() {
    if (els.next.disabled) return;
    if (state.index < TOTAL - 1) {
      state.index += 1;
      renderQuestion("fwd");
    } else {
      showResult();
    }
  }

  function back() {
    if (state.index === 0) return;
    state.index -= 1;
    renderQuestion("back");
  }

  function animateNumber(el, target, ms) {
    if (reduceMotion) { el.textContent = target.toFixed(2); return; }
    var t0 = null;
    function frame(t) {
      if (!t0) t0 = t;
      var k = Math.min((t - t0) / ms, 1);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * eased).toFixed(2);
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // --- отправка результата (анонимно, fire-and-forget; без бэкенда уходит в catch) ---
  function newId() {
    var bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function buildPayload() {
    var answers = {};
    state.answers.forEach(function (a, id) { answers["q" + id] = a.i; });
    return {
      id: state.submissionId, version: QUIZ_VERSION, answers: answers,
      q33: state.rating, R: state.result.R, level: state.result.level,
      F: { F1: state.result.factors.F1, F2: state.result.factors.F2,
           F3: state.result.factors.F3, F4: state.result.factors.F4 }
    };
  }
  function submitResult(payload) {
    try {
      fetch("/api/results", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) { /* file:// или старый браузер — результат всё равно показан */ }
  }

  function onRate() {
    var input = els.rRatingOptions.querySelector("input:checked");
    if (!input) return;
    state.rating = Number(input.value);
    els.rRatingOptions.querySelectorAll("input").forEach(function (inp) { inp.disabled = true; });
    els.rRatingOptions.querySelectorAll(".option").forEach(function (o) {
      o.classList.toggle("is-checked", o.querySelector("input").checked);
    });
    els.rRatingThanks.hidden = false;
    submitResult(buildPayload());
  }

  function showResult() {
    var plain = new Map();
    state.answers.forEach(function (a, id) { plain.set(id, a.score); });
    var res = computeResult(plain);
    var txt = RESULT_TEXTS[res.level];
    state.result = res;
    state.rating = null;
    state.submissionId = newId();

    els.result.setAttribute("data-level", res.level);
    els.rTitle.textContent = txt.title;
    els.rSub.textContent = txt.sub;
    els.rNote.textContent = txt.note;
    els.rRemember.textContent = txt.remember;
    els.rCards.innerHTML = txt.cards.map(function (c, i) {
      var chip = ["", "icon-chip--sky", "icon-chip--lilac"][i] || "";
      return '<div class="card">' +
        '<span class="icon-chip ' + chip + '" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21 C 7 18, 4.5 13.5, 6 7.5 C 12 7, 17 9.5, 18 15 C 18.7 18.5, 16 20.5, 12 21 Z"/><path d="M8.5 17.5 C 11 15, 13.5 12.5, 16 10.5"/></svg>' +
        "</span><h3 style=\"font-size:17px\">" + c[0] + '</h3><p class="muted">' + c[1] + "</p></div>";
    }).join("");
    els.rContacts.hidden = (res.level !== "high");
    els.rRatingText.textContent = RATING_QUESTION.text;
    els.rRatingOptions.innerHTML = renderOptions(RATING_QUESTION, "q33", -1);
    els.rRatingThanks.hidden = true;

    showScreen(els.result);
    animateNumber(els.rNum, res.R, 900);

    var bars = els.rBars.querySelectorAll(".factor-bar");
    bars.forEach(function (bar, i) {
      var f = bar.getAttribute("data-factor");
      var val = res.factors[f];
      bar.querySelector(".factor-bar__value").textContent = val.toFixed(2);
      var fill = bar.querySelector(".factor-bar__fill");
      var width = (val / 5 * 100) + "%";
      if (reduceMotion) { fill.style.width = width; }
      else setTimeout(function () { fill.style.width = width; }, 250 + i * 120);
    });

    submitResult(buildPayload());
  }

  function restart() {
    state.index = 0;
    state.answers = new Map();
    state.result = null; state.rating = null; state.submissionId = null;
    els.rBars.querySelectorAll(".factor-bar__fill").forEach(function (f) { f.style.width = "0"; });
    els.rNum.textContent = "0.00";
    showScreen(els.intro);
  }

  // --- события ---
  els.total.textContent = String(TOTAL);
  els.track.setAttribute("aria-valuemax", String(TOTAL));
  els.start.disabled = !els.consent.checked;
  els.consent.addEventListener("change", function () { els.start.disabled = !els.consent.checked; });
  els.rRatingOptions.addEventListener("change", onRate);
  els.start.addEventListener("click", function () {
    if (!els.consent.checked) return;
    showScreen(els.quiz);
    renderQuestion();
  });
  els.options.addEventListener("change", onSelect);
  els.next.addEventListener("click", next);
  els.back.addEventListener("click", back);
  els.form.addEventListener("submit", function (e) { e.preventDefault(); next(); });
  els.exit.addEventListener("click", function () { els.modal.hidden = false; });
  els.stay.addEventListener("click", function () { els.modal.hidden = true; });
  els.modal.addEventListener("click", function (e) { if (e.target === els.modal) els.modal.hidden = true; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.modal.hidden) els.modal.hidden = true;
  });
  els.restart.addEventListener("click", restart);
  els.print.addEventListener("click", function () { window.print(); });
})();
