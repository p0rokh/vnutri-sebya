"use strict";
/*
 * Модель теста «Внутри себя», опросник v2 (input/Вопросы-v2.txt).
 * Единственный источник правды: 33 вопроса (32 в потоке + оценка проекта
 * на экране результата), шкалы баллов, коды пропусков, веса факторов и
 * подсчёт результата (docs/Аналитика.md §3–4). Без DOM — файл работает
 * и в браузере (classic script), и в Node/deno (тесты).
 *
 * Пороги уровней LEVELS — ВРЕМЕННЫЕ (пропорциональный перенос 1.5/2.5 со
 * шкалы 1–4 на 1–5). Итоговые решает Алиса: docs/Открытые-вопросы.md §1.
 */

var QUIZ_VERSION = "2";

// Коды нечисловых ответов. В подсчёт не входят, в статистике видны отдельно.
var CODES = { DECLINE: -1, UNSURE: -2 };
var OPT_DECLINE = { code: CODES.DECLINE, label: "Предпочитаю не отвечать", hint: "Этот вопрос можно пропустить" };
var OPT_UNSURE  = { code: CODES.UNSURE,  label: "Затрудняюсь ответить" };

var SECTIONS = {
  1: "Общая информация",
  2: "Отношение к еде и собственному телу",
  3: "Семейное окружение",
  4: "Окружение",
  5: "Дополнительная информация",
  6: "Рефлексия и оценка проекта"
};

var SCALE_DEFAULT = [
  { value: 1, label: "Никогда",      hint: "Такого не бывает" },
  { value: 2, label: "Редко",        hint: "Бывает очень редко" },
  { value: 3, label: "Иногда",       hint: "Время от времени" },
  { value: 4, label: "Часто",        hint: "Такое происходит регулярно" },
  { value: 5, label: "Почти всегда", hint: "Это про меня" }
];
var SCALE_SKIPPABLE = SCALE_DEFAULT.concat([OPT_DECLINE]);

var QUESTIONS = [
  // Раздел 1 — общая информация (в подсчёт не входит)
  { id: 1, section: 1, factor: null, text: "Укажите ваш пол",
    options: [
      { label: "Женский" },
      { label: "Мужской" },
      { label: "Другой вариант" },
      OPT_DECLINE
    ] },
  { id: 2, section: 1, factor: null, text: "Сколько вам полных лет?",
    options: [
      { label: "До 14 лет" },
      { label: "14–17 лет" },
      { label: "18–25 лет" },
      { label: "26 лет и старше" },
      OPT_DECLINE
    ] },
  // Раздел 2 — отношение к еде и телу
  // F1 — когнитивные установки
  { id: 3, section: 2, factor: "F1", text: "Я думаю о еде большую часть дня" },
  { id: 4, section: 2, factor: "F1", text: "Я испытываю чувство вины после еды" },
  { id: 5, section: 2, factor: "F1", text: "Я стараюсь избегать еды, даже если голоден(-на)" },
  { id: 6, section: 2, factor: "F1", text: "Я делю еду на «хорошую» и «плохую»" },
  // F2 — образ тела и самооценка
  { id: 7,  section: 2, factor: "F2", text: "Я боюсь набрать вес" },
  { id: 8,  section: 2, factor: "F2", text: "Я сравниваю себя с другими по внешности" },
  { id: 9,  section: 2, factor: "F2", text: "Моё настроение зависит от моего веса или внешности" },
  { id: 10, section: 2, factor: "F2", text: "Я ограничиваю себя в еде ради контроля веса" },
  // F3 — пищевое поведение
  { id: 11, section: 2, factor: "F3", text: "У меня бывают эпизоды переедания" },
  { id: 12, section: 2, factor: "F3", text: "Я использую физические нагрузки, чтобы «сжечь» съеденное" },
  { id: 13, section: 2, factor: "F3", text: "Я скрываю свои пищевые привычки от других" },
  { id: 14, section: 2, factor: "F3", text: "Я заедаю стресс или сильные эмоции" },
  { id: 15, section: 2, factor: "F3", text: "Я чувствую, что не контролирую своё питание" },
  { id: 16, section: 2, factor: "F3", text: "Я испытываю тревогу, если не могу контролировать рацион" },
  { id: 17, section: 2, factor: "F3", text: "Я вызываю рвоту после еды", options: SCALE_SKIPPABLE, skippable: true },
  // F4 — внешние факторы (компенсаторное поведение + семья + окружение)
  { id: 18, section: 2, factor: "F4", text: "Я использую слабительные или другие средства для контроля веса", options: SCALE_SKIPPABLE, skippable: true },
  { id: 19, section: 2, factor: "F4", text: "Я пропускаю приёмы пищи после переедания", options: SCALE_SKIPPABLE, skippable: true },
  { id: 20, section: 2, factor: "F4", text: "Я намеренно голодаю, чтобы «компенсировать» съеденное", options: SCALE_SKIPPABLE, skippable: true },
  { id: 21, section: 2, factor: "F4", text: "После еды у меня возникает сильное желание «избавиться» от неё", options: SCALE_SKIPPABLE, skippable: true },
  // Раздел 3 — семейное окружение
  { id: 22, section: 3, factor: "F4", text: "В моей семье часто обсуждают вес и внешность" },
  { id: 23, section: 3, factor: "F4", text: "Родители или близкие критикуют моё питание" },
  { id: 24, section: 3, factor: "F4", text: "Я слышу комментарии о своём теле или весе" },
  { id: 25, section: 3, factor: "F4", text: "В семье есть установки вроде «нужно есть меньше»" },
  { id: 26, section: 3, factor: "F4", text: "Родители контролируют, сколько и что я ем" },
  { id: 27, section: 3, factor: "F4", text: "В семье напряжённая атмосфера во время еды" },
  { id: 28, section: 3, factor: "F4", text: "Я чувствую давление соответствовать идеальной внешности" },
  { id: 29, section: 3, factor: "F4", text: "В семье есть люди с проблемами питания или веса",
    options: [ // баллы Да/Нет — открытый вопрос (docs/Открытые-вопросы.md §2)
      { value: 5, label: "Да" },
      { value: 1, label: "Нет" },
      OPT_UNSURE,
      OPT_DECLINE
    ] },
  // Раздел 4 — окружение
  { id: 30, section: 4, factor: "F4", text: "Сколько человек в твоём окружении имеют проблемы с отношением к еде?",
    options: [ // баллы — открытый вопрос (docs/Открытые-вопросы.md §3)
      { value: 1, label: "Ни одного" },
      { value: 2, label: "1–2 человека" },
      { value: 4, label: "3–5 человек" },
      { value: 5, label: "Более 5 человек" },
      OPT_UNSURE
    ] },
  { id: 31, section: 4, factor: "F4", text: "Насколько их поведение влияет на тебя?",
    options: [
      { value: 1, label: "Совсем не влияет" },
      { value: 2, label: "Слабо влияет" },
      { value: 3, label: "Умеренно влияет" },
      { value: 4, label: "Сильно влияет" },
      { value: 5, label: "Очень сильно влияет" },
      OPT_UNSURE
    ] },
  // Раздел 5 — дополнительная информация (в подсчёт не входит)
  { id: 32, section: 5, factor: null, text: "Есть ли у вас расстройство пищевого поведения (РПП), подтверждённое врачом?",
    options: [
      { label: "Да, диагноз подтверждён врачом" },
      { label: "Нет, у меня нет подтверждённого диагноза" },
      { label: "Я обращался(-ась) к специалисту, но диагноз не установлен" },
      { label: "Я подозреваю у себя РПП, но не обращался(-ась) к специалисту" },
      OPT_UNSURE,
      OPT_DECLINE
    ] }
];

// Раздел 6 — задаётся на экране результата, в подсчёт не входит
var RATING_QUESTION = { id: 33, section: 6, factor: null,
  text: "Насколько полезной и актуальной вы считаете проведённую работу о факторах риска развития РПП?",
  options: [
    { label: "Очень полезной и актуальной" },
    { label: "Скорее полезной" },
    { label: "Нейтральной" },
    { label: "Скорее неинтересной или мало полезной" },
    { label: "Совсем неинтересной или не полезной" },
    OPT_UNSURE
  ] };

var ALL_QUESTIONS = QUESTIONS.concat([RATING_QUESTION]);

function optionsFor(q) { return q.options || SCALE_DEFAULT; }
// Балл варианта: value (1..5) либо код (<0) для «не отвечать»/«затрудняюсь».
function scoreOf(opt) { return typeof opt.value === "number" ? opt.value : opt.code; }

var WEIGHTS = { F1: 0.25, F2: 0.25, F3: 0.3, F4: 0.2 };

// ВРЕМЕННО: см. docs/Открытые-вопросы.md §1
var LEVELS = { mediumFrom: 1.67, highFrom: 3.0 };

function levelFor(R) {
  return R < LEVELS.mediumFrom ? "low" : R < LEVELS.highFrom ? "medium" : "high";
}

// answers: Map<id, number> — балл 1..5 или код (<0). Коды исключаются,
// среднее по фактору считается по отвеченным вопросам.
function computeResult(answers) {
  var sums = { F1: 0, F2: 0, F3: 0, F4: 0 };
  var counts = { F1: 0, F2: 0, F3: 0, F4: 0 };
  for (var i = 0; i < QUESTIONS.length; i++) {
    var q = QUESTIONS[i];
    if (!q.factor) continue;
    var v = answers.get(q.id);
    if (typeof v !== "number") throw new Error("Нет ответа на вопрос " + q.id);
    if (v < 0) continue;
    sums[q.factor] += v;
    counts[q.factor] += 1;
  }
  var factors = {};
  for (var f in sums) {
    if (!counts[f]) throw new Error("Нет ни одного ответа по фактору " + f);
    factors[f] = sums[f] / counts[f];
  }
  var raw = WEIGHTS.F1 * factors.F1 + WEIGHTS.F2 * factors.F2 +
            WEIGHTS.F3 * factors.F3 + WEIGHTS.F4 * factors.F4;
  // Классифицируем по округлённому до 2 знаков значению: пользователь видит
  // «3.00» — уровень обязан соответствовать показанному числу.
  var R = Math.round(raw * 100) / 100;
  return { R: R, factors: factors, level: levelFor(R) };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { QUIZ_VERSION, CODES, OPT_DECLINE, OPT_UNSURE, SECTIONS, SCALE_DEFAULT, SCALE_SKIPPABLE,
    QUESTIONS, RATING_QUESTION, ALL_QUESTIONS, optionsFor, scoreOf, WEIGHTS, LEVELS, computeResult, levelFor };
}
