"use strict";
/*
 * DOM-механика теста. Все числа модели — в quiz.js (QUESTIONS, SCALE_DEFAULT,
 * WEIGHTS, computeResult); здесь только экраны, рендер и анимации.
 */
(function () {
  var TOTAL = QUESTIONS.length; // 29
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Ответы: Map<id, {i: индекс варианта, value: балл}> — индекс нужен,
  // чтобы «Назад» восстанавливал выбор (у q28 два варианта по 4 балла).
  var state = { index: 0, answers: new Map() };

  var els = {
    intro:   document.getElementById("scr-intro"),
    quiz:    document.getElementById("scr-quiz"),
    result:  document.getElementById("scr-result"),
    start:   document.getElementById("q-start"),
    num:     document.getElementById("q-num"),
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
    restart: document.getElementById("q-restart"),
    print:   document.getElementById("q-print")
  };

  // Мини-иконки настроения для стандартной шкалы (лист → волны → облако → дождь)
  var MOOD_ICONS = {
    1: '<path d="M13 20 C 8 17, 5.5 12.5, 7 6.5 C 13 6, 18 8.5, 19 14 C 19.7 17.5, 17 19.5, 13 20 Z"/><path d="M9.5 16.5 C 12 14, 14.5 11.5, 17 9.5"/>',
    2: '<path d="M4 9c2.5-2 5.5-2 8 0s5.5 2 8 0"/><path d="M4 14c2.5-2 5.5-2 8 0s5.5 2 8 0"/>',
    3: '<path d="M7 17a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.8-1A4.2 4.2 0 0 1 16.8 17z"/>',
    4: '<path d="M7 14a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.8-1A4.2 4.2 0 0 1 16.8 14z"/><path d="M9 17.5v2M13 17.5v2M17 17.5v2"/>'
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
  function optionsFor(q) { return q.options || SCALE_DEFAULT; }

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

    var saved = state.answers.get(q.id);
    var html = "";
    optionsFor(q).forEach(function (opt, i) {
      var isDefaultScale = !q.options;
      html +=
        '<label class="option">' +
          '<input type="radio" name="q' + q.id + '" value="' + i + '"' +
            (saved && saved.i === i ? " checked" : "") + ">" +
          '<span class="option__mark" aria-hidden="true"></span>' +
          '<span class="option__body">' +
            '<span class="option__label">' + opt.label + "</span>" +
            (opt.hint ? '<span class="option__hint">' + opt.hint + "</span>" : "") +
          "</span>" +
          (isDefaultScale
            ? '<svg class="option__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MOOD_ICONS[opt.value] + "</svg>"
            : "") +
        "</label>";
    });
    els.options.innerHTML = html;
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
    state.answers.set(q.id, { i: i, value: optionsFor(q)[i].value });
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

  function showResult() {
    var plain = new Map();
    state.answers.forEach(function (a, id) { plain.set(id, a.value); });
    var res = computeResult(plain);
    var txt = RESULT_TEXTS[res.level];

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

    showScreen(els.result);
    animateNumber(els.rNum, res.R, 900);

    var bars = els.rBars.querySelectorAll(".factor-bar");
    bars.forEach(function (bar, i) {
      var f = bar.getAttribute("data-factor");
      var val = res.factors[f];
      bar.querySelector(".factor-bar__value").textContent = val.toFixed(2);
      var fill = bar.querySelector(".factor-bar__fill");
      var width = (val / 4 * 100) + "%";
      if (reduceMotion) { fill.style.width = width; }
      else setTimeout(function () { fill.style.width = width; }, 250 + i * 120);
    });
  }

  function restart() {
    state.index = 0;
    state.answers = new Map();
    els.rBars.querySelectorAll(".factor-bar__fill").forEach(function (f) { f.style.width = "0"; });
    els.rNum.textContent = "0.00";
    showScreen(els.intro);
  }

  // --- события ---
  els.start.addEventListener("click", function () {
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
