// Run with: node test/api.test.js   (no dependencies; uses a throwaway store file)
const os = require("os");
const path = require("path");
const fs = require("fs");
process.env.EXAM_READY_STORE_FILE = path.join(os.tmpdir(), `exam-ready-test-${process.pid}.json`);
delete process.env.KV_REST_API_URL; delete process.env.UPSTASH_REDIS_REST_URL;

const assert = require("assert");
const H = require("../lib/handlers");
const { QUESTIONS } = require("../lib/questions");

const correct = () => QUESTIONS.map((q) => ({ id: q.id, choice: q.answer }));
const unsure = () => QUESTIONS.map((q) => ({ id: q.id, choice: null }));
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

(async () => {
  await t("questions endpoint never leaks the answer key", async () => {
    const { json } = H.questions();
    const text = JSON.stringify(json);
    assert.strictEqual(json.questions.length, 15);
    for (const q of json.questions) {
      assert.ok(!("answer" in q) && !("why" in q) && !("difficulty" in q) && !("topic" in q));
    }
    assert.ok(!text.includes("Correct answer") && !text.includes("Akkusativ"));
  });

  await t("score rejects incomplete, duplicate and out-of-range answers", async () => {
    for (const body of [
      {}, { answers: [] }, { answers: correct().slice(1) },
      { answers: [...correct().slice(0, 14), correct()[0]] },
      { answers: correct().map((a, i) => (i ? a : { ...a, choice: 99 })) },
      { answers: correct().map((a, i) => (i ? a : { ...a, choice: "0" })) },
    ]) {
      assert.strictEqual((await H.scoreAttempt({ body })).status, 400);
    }
    assert.strictEqual((await H.scoreAttempt({ body: { answers: correct(), examDays: -3 } })).status, 400);
  });

  let id;
  await t("score returns a result, review with answers, a plan and a saved id", async () => {
    const out = await H.scoreAttempt({ body: { answers: unsure(), examDays: 10 } });
    assert.strictEqual(out.status, 200);
    const { result } = out.json;
    id = out.json.id;
    assert.ok(id && id.length >= 6);
    assert.strictEqual(result.chance, 1);
    assert.strictEqual(result.review.length, 15);
    assert.strictEqual(typeof result.review[0].answer, "number");
    assert.ok(result.plan && result.plan.steps.length >= 1);
    assert.strictEqual(result.peers, null); // not enough data yet
  });

  await t("saved result can be fetched by link; bad ids are rejected", async () => {
    const out = await H.getResult({ query: { id } });
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.json.result.chance, 1);
    assert.strictEqual((await H.getResult({ query: { id: "nope" } })).status, 400);
    assert.strictEqual((await H.getResult({ query: { id: "abcdefghij" } })).status, 404);
  });

  await t("feedback validates input and updates the attempt", async () => {
    assert.strictEqual((await H.feedback({ body: { id, feel: "banana" } })).status, 400);
    assert.strictEqual((await H.feedback({ body: { id } })).status, 400);
    assert.strictEqual((await H.feedback({ body: { id: "abcdefghij", feel: "about-right" } })).status, 404);
    assert.strictEqual((await H.feedback({ body: { id, feel: "too-low", outcome: "failed" } })).status, 200);
    const got = (await H.getResult({ query: { id } })).json;
    assert.strictEqual(got.feel, "too-low");
    assert.strictEqual(got.outcome, "failed");
  });

  await t("peers appear after enough attempts, and insights calibrate predicted vs actual", async () => {
    let last;
    for (let i = 0; i < 24; i++) {
      const strong = i % 2 === 0;
      const out = await H.scoreAttempt({ body: { answers: strong ? correct() : unsure() } });
      last = out.json;
      await H.feedback({ body: { id: out.json.id, outcome: strong ? "passed" : "failed" } });
    }
    assert.ok(last.result.peers && last.result.peers.n >= 20);
    const { json } = await H.insights();
    assert.strictEqual(json.attempts, 25);
    const hi = json.calibration.find((b) => b.label === "75–100%");
    const lo = json.calibration.find((b) => b.label === "0–25%");
    assert.strictEqual(hi.actual, 100);
    assert.strictEqual(lo.actual, 0);
    assert.ok(hi.predicted >= 75 && lo.predicted <= 25);
    assert.strictEqual(json.questions.length, 15);
    assert.strictEqual(json.outcomes.passed, 12);
  });

  await t("insights are aggregate only: no attempt ids or answers", async () => {
    const { json } = await H.insights();
    const text = JSON.stringify(json);
    assert.ok(!text.includes(id), "an attempt id leaked");
    assert.ok(!text.includes('"choice"') && !text.includes('"answers"'));
  });

  fs.rmSync(process.env.EXAM_READY_STORE_FILE, { force: true });
  console.log(`\n${n} API tests passed`);
})().catch((e) => { console.error(e); process.exit(1); });
