"use strict";
const assert = require("node:assert");
const { QUESTIONS, SCALE_DEFAULT, WEIGHTS, computeResult, levelFor } =
  require("../site/js/quiz.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  -", name); }
  catch (e) { failed++; console.error("  FAIL -", name, "\n        " + e.message); }
}

console.log("Данные модели:");
test("вопросов ровно 29", () => assert.equal(QUESTIONS.length, 29));
test("id идут 1..29 без пропусков", () =>
  assert.deepEqual(QUESTIONS.map(q => q.id), Array.from({ length: 29 }, (_, i) => i + 1)));
test("факторы распределены как в Аналитике §3.2", () => {
  const by = { F1: [], F2: [], F3: [], F4: [] };
  QUESTIONS.forEach(q => by[q.factor].push(q.id));
  assert.deepEqual(by.F1, [1, 2, 3, 4]);
  assert.deepEqual(by.F2, [5, 6, 7, 8]);
  assert.deepEqual(by.F3, [9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(by.F4, [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
});
test("стандартная шкала 1..4", () =>
  assert.deepEqual(SCALE_DEFAULT.map(o => o.value), [1, 2, 3, 4]));
test("q28: пять вариантов с баллами 1,2,3,4,4", () => {
  const q = QUESTIONS.find(q => q.id === 28);
  assert.deepEqual(q.options.map(o => o.value), [1, 2, 3, 4, 4]);
});
test("q29: четыре варианта 1..4", () => {
  const q = QUESTIONS.find(q => q.id === 29);
  assert.deepEqual(q.options.map(o => o.value), [1, 2, 3, 4]);
});
test("q1–q27 используют стандартную шкалу (options нет)", () =>
  QUESTIONS.filter(q => q.id <= 27).forEach(q => assert.equal(q.options, undefined)));
test("веса из презентации, сумма 1", () => {
  assert.deepEqual(WEIGHTS, { F1: 0.25, F2: 0.25, F3: 0.3, F4: 0.2 });
});

function answersWhere(rule) { // rule(id) -> балл
  const m = new Map();
  QUESTIONS.forEach(q => m.set(q.id, rule(q.id)));
  return m;
}
function maxValue(q) { return (q.options || SCALE_DEFAULT).reduce((a, o) => Math.max(a, o.value), 0); }

console.log("\ncomputeResult (контрольные примеры Аналитики §3.5):");
test("все = 1 → R=1.00, низкий", () => {
  const r = computeResult(answersWhere(() => 1));
  assert.equal(r.R.toFixed(2), "1.00");
  assert.equal(r.level, "low");
});
test("все = 2 → R=2.00, средний", () => {
  const r = computeResult(answersWhere(() => 2));
  assert.equal(r.R.toFixed(2), "2.00");
  assert.equal(r.level, "medium");
});
test("все = максимум → R=4.00, высокий", () => {
  const r = computeResult(answersWhere(id => maxValue(QUESTIONS.find(q => q.id === id))));
  assert.equal(r.R.toFixed(2), "4.00");
  assert.equal(r.level, "high");
});
test("q1–8=1, q9–29=2 → R=1.50, средний (граница вверх)", () => {
  const r = computeResult(answersWhere(id => (id <= 8 ? 1 : 2)));
  assert.equal(r.R.toFixed(2), "1.50");
  assert.equal(r.level, "medium");
});
test("q1–8=1, q9–29=4 → R=2.50, высокий (граница вверх)", () => {
  const r = computeResult(answersWhere(id => (id <= 8 ? 1 : 4)));
  assert.equal(r.R.toFixed(2), "2.50");
  assert.equal(r.level, "high");
});
test("q1–4=4, остальные=1 → R=1.75, средний", () => {
  const r = computeResult(answersWhere(id => (id <= 4 ? 4 : 1)));
  assert.equal(r.R.toFixed(2), "1.75");
  assert.equal(r.level, "medium");
});
test("факторы в результате: сверка среднего", () => {
  const r = computeResult(answersWhere(id => (id <= 8 ? 1 : 2)));
  assert.equal(r.factors.F1, 1); assert.equal(r.factors.F2, 1);
  assert.equal(r.factors.F3, 2); assert.equal(r.factors.F4, 2);
});
test("неполные ответы → понятная ошибка", () => {
  assert.throws(() => computeResult(new Map([[1, 2]])), /Нет ответа/);
});
test("levelFor: границы", () => {
  assert.equal(levelFor(1.49), "low");
  assert.equal(levelFor(1.5), "medium");
  assert.equal(levelFor(2.49), "medium");
  assert.equal(levelFor(2.5), "high");
});

console.log(`\n${passed} ok, ${failed} fail`);
process.exit(failed ? 1 : 0);
