"use strict";
// Запуск: deno run --unstable-detect-cjs --allow-read=. tests/quiz.test.js  (или node tests/quiz.test.js)
const assert = require("node:assert");
const { QUESTIONS, RATING_QUESTION, ALL_QUESTIONS, SCALE_DEFAULT, SCALE_SKIPPABLE, WEIGHTS, LEVELS,
  QUIZ_VERSION, optionsFor, scoreOf, computeResult, levelFor } = require("../site/js/quiz.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  -", name); }
  catch (e) { failed++; console.error("  FAIL -", name, "\n        " + e.message); }
}
const q = id => ALL_QUESTIONS.find(x => x.id === id);
const scores = id => optionsFor(q(id)).map(scoreOf);
const numeric = id => scores(id).filter(v => v > 0);
const minScore = id => Math.min(...numeric(id));
const maxScore = id => Math.max(...numeric(id));
function answersWhere(rule) { // rule(id) -> балл или код
  const m = new Map();
  QUESTIONS.forEach(x => m.set(x.id, rule(x.id)));
  return m;
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

console.log("Данные модели:");
test("в потоке 32 вопроса, id 1..32; оценка проекта — id 33; всего 33", () => {
  assert.deepEqual(QUESTIONS.map(x => x.id), range(1, 32));
  assert.equal(RATING_QUESTION.id, 33);
  assert.equal(ALL_QUESTIONS.length, 33);
});
test("факторы: F1=3..6, F2=7..10, F3=11..17, F4=18..31, нет у 1,2,32,33", () => {
  const by = { F1: [], F2: [], F3: [], F4: [], none: [] };
  ALL_QUESTIONS.forEach(x => by[x.factor || "none"].push(x.id));
  assert.deepEqual(by.F1, range(3, 6));
  assert.deepEqual(by.F2, range(7, 10));
  assert.deepEqual(by.F3, range(11, 17));
  assert.deepEqual(by.F4, range(18, 31));
  assert.deepEqual(by.none, [1, 2, 32, 33]);
});
test("разделы 1..6 по плану", () => {
  const sec = id => q(id).section;
  assert.deepEqual([1, 2].map(sec), [1, 1]);
  assert.ok(range(3, 21).every(id => sec(id) === 2));
  assert.ok(range(22, 29).every(id => sec(id) === 3));
  assert.deepEqual([30, 31, 32, 33].map(sec), [4, 4, 5, 6]);
});
test("стандартная шкала 1..5, skippable = шкала + «не отвечать» (-1)", () => {
  assert.deepEqual(SCALE_DEFAULT.map(scoreOf), [1, 2, 3, 4, 5]);
  assert.deepEqual(SCALE_SKIPPABLE.map(scoreOf), [1, 2, 3, 4, 5, -1]);
});
test("skippable ровно у 17..21", () =>
  assert.deepEqual(QUESTIONS.filter(x => x.skippable).map(x => x.id), range(17, 21)));
test("баллы/коды особых вопросов", () => {
  assert.deepEqual(scores(29), [5, 1, -2, -1]);
  assert.deepEqual(scores(30), [1, 2, 4, 5, -2]);
  assert.deepEqual(scores(31), [1, 2, 3, 4, 5, -2]);
  assert.deepEqual(scores(32).slice(4), [-2, -1]);
  assert.equal(scores(33).length, 6);
  assert.equal(scores(1).pop(), -1);
  assert.equal(scores(2).pop(), -1);
});
test("веса и временные пороги", () => {
  assert.deepEqual(WEIGHTS, { F1: 0.25, F2: 0.25, F3: 0.3, F4: 0.2 });
  assert.deepEqual(LEVELS, { mediumFrom: 1.67, highFrom: 3.0 });
  assert.equal(QUIZ_VERSION, "2");
});

console.log("\ncomputeResult:");
const isFactor = id => !!q(id).factor;
test("все минимальные → R=1.00, low", () => {
  const r = computeResult(answersWhere(id => (isFactor(id) ? minScore(id) : 0)));
  assert.equal(r.R.toFixed(2), "1.00"); assert.equal(r.level, "low");
});
test("все максимальные → R=5.00, high", () => {
  const r = computeResult(answersWhere(id => (isFactor(id) ? maxScore(id) : 0)));
  assert.equal(r.R.toFixed(2), "5.00"); assert.equal(r.level, "high");
});
test("q3–10=1, q11–31=max → R=3.00, high (граница)", () => {
  const r = computeResult(answersWhere(id => (id <= 10 ? 1 : maxScore(id))));
  assert.equal(r.R.toFixed(2), "3.00"); assert.equal(r.level, "high");
});
test("q3–6=5, остальные min → R=2.00, medium", () => {
  const r = computeResult(answersWhere(id => (id <= 6 ? 5 : isFactor(id) ? minScore(id) : 0)));
  assert.equal(r.R.toFixed(2), "2.00"); assert.equal(r.level, "medium");
});
test("пропуски исключаются: q17–21=-1, q29–31=-2, остальные max → R=5.00", () => {
  const r = computeResult(answersWhere(id => (id >= 17 && id <= 21 ? -1 : id >= 29 && id <= 31 ? -2 : isFactor(id) ? maxScore(id) : 0)));
  assert.equal(r.R.toFixed(2), "5.00"); assert.equal(r.factors.F3, 5); assert.equal(r.factors.F4, 5);
});
test("q11–15=1, q16=5, q17=-1 → F3=1.67 (среднее по 6)", () => {
  const r = computeResult(answersWhere(id => (id === 16 ? 5 : id === 17 ? -1 : isFactor(id) ? minScore(id) : 0)));
  assert.equal(r.factors.F3.toFixed(2), "1.67");
});
test("без q1, q2, q32 считается; без q3 — ошибка", () => {
  const m = answersWhere(id => (isFactor(id) ? 1 : 0));
  m.delete(1); m.delete(2); m.delete(32);
  assert.equal(computeResult(m).R, 1);
  m.delete(3);
  assert.throws(() => computeResult(m), /Нет ответа на вопрос 3/);
});
test("levelFor: границы LEVELS", () => {
  assert.equal(levelFor(LEVELS.mediumFrom - 0.01), "low");
  assert.equal(levelFor(LEVELS.mediumFrom), "medium");
  assert.equal(levelFor(LEVELS.highFrom - 0.01), "medium");
  assert.equal(levelFor(LEVELS.highFrom), "high");
});

console.log(`\n${passed} ok, ${failed} fail`);
process.exit(failed ? 1 : 0);
