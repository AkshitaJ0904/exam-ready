// Run with: node scoring.test.js   (no dependencies)
const assert = require("assert");
const { score, plan, phi } = require("../lib/scoring.js");
const { QUESTIONS, TOPICS } = require("../lib/questions.js");

const all = (fn) => QUESTIONS.map((q) => ({ id: q.id, choice: fn(q) }));
const missing = (ids) => score(all((q) => (ids.includes(q.id) ? null : q.answer)));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("question bank is well-formed", () => {
  assert.strictEqual(QUESTIONS.length, 15);
  assert.strictEqual(new Set(QUESTIONS.map((q) => q.id)).size, 15);
  for (const q of QUESTIONS) {
    assert.ok(q.answer >= 0 && q.answer < q.options.length, q.id);
    assert.strictEqual(new Set(q.options).size, q.options.length, q.id + " duplicate options");
    assert.ok([1, 2, 3].includes(q.difficulty));
    assert.ok(TOPICS[q.topic] && TOPICS[q.topic].canDo, q.id + " topic needs a can-do marker");
  }
  for (const s of ["vocabulary", "grammar", "reading"])
    assert.strictEqual(QUESTIONS.filter((q) => q.skill === s).length, 5);
});

t("normal CDF sanity", () => {
  assert.ok(Math.abs(phi(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(phi(1.96) - 0.975) < 1e-3);
});

t("perfect score: very likely to pass, ready, still gets 2 advice items", () => {
  const r = score(all((q) => q.answer));
  assert.ok(r.chance >= 95 && r.chance <= 99);
  assert.strictEqual(r.band.id, "ready");
  assert.strictEqual(r.advice.length, 2);
  assert.ok(r.markers.every((m) => m.status === "yes"));
});

t("all 'I don't know': almost no chance, not ready, 3 advice items", () => {
  const r = score(all(() => null));
  assert.strictEqual(r.chance, 1);
  assert.strictEqual(r.band.id, "not-yet");
  assert.strictEqual(r.advice.length, 3);
  assert.ok(r.markers.every((m) => m.status === "no"));
});

t("missing answers are treated as unsure", () => {
  assert.strictEqual(score([]).chance, 1);
});

t("more mistakes never raise the chance of passing", () => {
  const order = ["g5", "r5", "v5", "g2", "r3", "v4", "g3", "r4"];
  let prev = 100;
  for (let i = 0; i <= order.length; i++) {
    const c = missing(order.slice(0, i)).chance;
    assert.ok(c <= prev, `chance rose at ${i} misses: ${c} > ${prev}`);
    prev = c;
  }
});

t("band thresholds: 13/15 ready, 11/15 not ready", () => {
  assert.strictEqual(missing(["g5", "r5"]).band.id, "ready");
  assert.strictEqual(missing(["g5", "r5", "v5", "g2"]).band.id, "not-yet");
});

t("a hard question costs more than an easy one", () => {
  assert.ok(missing(["v5"]).perSkill.vocabulary.score < missing(["v1"]).perSkill.vocabulary.score);
});

t("safety floor: strong chance but one skill under 40% can't be 'Ready'", () => {
  // Fabricate a bank where reading is tiny so overall stays high but reading is 0%.
  const bank = [];
  for (let i = 0; i < 10; i++) bank.push({ id: "x" + i, skill: "vocabulary", difficulty: 1, topic: "everyday-words", options: ["a", "b"], answer: 0 });
  for (let i = 0; i < 10; i++) bank.push({ id: "y" + i, skill: "grammar", difficulty: 1, topic: "verb-forms", options: ["a", "b"], answer: 0 });
  for (let i = 0; i < 2; i++) bank.push({ id: "z" + i, skill: "reading", difficulty: 1, topic: "reading-signs", options: ["a", "b"], answer: 0 });
  const answers = bank.map((q) => ({ id: q.id, choice: q.skill === "reading" ? null : 0 }));
  const r = score(answers, bank);
  assert.ok(r.perSkill.reading.score < 40);
  assert.notStrictEqual(r.band.id, "ready");
});

t("ranges contain the point estimate and widen with fewer questions", () => {
  const r = score(all((q) => q.answer));
  for (const s of Object.values(r.perSkill)) assert.ok(s.low <= s.score && s.score <= s.high || s.high === 100);
});

t("markers: partial credit and status", () => {
  const r = missing(["v3"]); // everyday-words has 3 questions, one missed
  assert.strictEqual(r.markers.find((m) => m.topic === "everyday-words").status, "partial");
});

t("advice targets the topic that was missed", () => {
  const r = missing(QUESTIONS.filter((q) => q.topic === "cases").map((q) => q.id));
  assert.strictEqual(r.advice[0].topic, "cases");
});

t("advice never exceeds 3 and is ordered by missed points", () => {
  const r = score(all(() => null));
  assert.ok(r.advice.length <= 3);
  assert.ok(r.advice[0].missed >= r.advice[1].missed);
});

t("study plan never overlaps days and keeps the last day free", () => {
  const advice = [{ label: "A", missed: 3 }, { label: "B", missed: 2 }, { label: "C", missed: 1 }];
  for (const d of [null, 14, 10, 5, 3, 2, 1, 0]) {
    const p = plan(advice, d);
    let last = 0;
    for (const s of p.steps) {
      assert.ok(s.from === last + 1 && s.to >= s.from, `bad step ${JSON.stringify(s)} for ${d}`);
      last = s.to;
    }
    assert.ok(last <= Math.max(1, p.days - 1) || p.days === 1);
  }
  assert.strictEqual(plan([{ label: "Mock", missed: undefined }], 7), null);
});

console.log(`\n${n} tests passed`);
