/*
 * API logic, written as plain functions so the same code runs behind Vercel functions (api/*.js)
 * and the local dev server (server.js).  Each handler: ({ query, body }) -> { status, json }.
 *
 * What the backend adds to the product (this is the heart of "is the score right?"):
 *   - the answer key and the scoring rules never leave the server;
 *   - every attempt is stored anonymously (no name, email, IP or exam date);
 *   - learners can say whether the result felt right and, later, how the real exam went;
 *   - /api/insights turns that into a calibration table (predicted chance vs real outcome)
 *     and a question-health report, which is exactly how v2 gets tuned.
 */
const crypto = require("crypto");
const store = require("./store");
const { SKILLS, QUESTIONS } = require("./questions");
const { score, plan, PASS_LINE, READY_AT, ALMOST_AT, SKILL_FLOOR } = require("./scoring");

const ATTEMPT_LIST = "attempts";
const MIN_PEERS = 20;
const FEEL = ["too-high", "about-right", "too-low"];
const OUTCOME = ["passed", "failed", "not-taken"];
const QBYID = new Map(QUESTIONS.map((q) => [q.id, q]));

const ok = (json) => ({ status: 200, json });
const bad = (status, message) => ({ status, json: { error: message } });
const newId = () => crypto.randomBytes(7).toString("base64url");

// ---------- GET /api/questions ----------
function questions() {
  return ok({
    skills: Object.fromEntries(Object.entries(SKILLS).map(([k, v]) => [k, { label: v.label, blurb: v.blurb }])),
    // Only what the learner needs to see. No answers, difficulty or topics.
    questions: QUESTIONS.map((q) => ({ id: q.id, skill: q.skill, passage: q.passage || null, prompt: q.prompt, options: q.options })),
  });
}

// ---------- helpers ----------
function validateAnswers(raw) {
  if (!Array.isArray(raw) || raw.length !== QUESTIONS.length) return null;
  const seen = new Set();
  const out = [];
  for (const a of raw) {
    const q = a && QBYID.get(a.id);
    if (!q || seen.has(a.id)) return null;
    const c = a.choice;
    if (c !== null && !(Number.isInteger(c) && c >= 0 && c < q.options.length)) return null;
    seen.add(a.id);
    out.push({ id: a.id, choice: c });
  }
  return out;
}

async function loadAttempts(limit) {
  const ids = await store.range(ATTEMPT_LIST, limit);
  return (await store.mget(ids.map((id) => `attempt:${id}`))).filter(Boolean);
}

// "How you compare": share of earlier learners you scored above. Hidden until there is enough data.
function peerStats(result, attempts) {
  if (attempts.length < MIN_PEERS) return null;
  const below = (get, mine) => Math.round((attempts.filter((a) => get(a) < mine).length / attempts.length) * 100);
  return {
    n: attempts.length,
    overall: below((a) => a.chance, result.chance),
    skills: Object.fromEntries(Object.keys(SKILLS).map((k) => [k, below((a) => a.skills[k], result.perSkill[k].score)])),
  };
}

function publicResult(r, p, peers) {
  return {
    chance: r.chance,
    band: r.band,
    range: r.range,
    weakestSkill: r.weakestSkill,
    weakSkillCapped: r.weakSkillCapped,
    perSkill: r.perSkill,
    markers: r.markers,
    advice: r.advice.map(({ topic, label, action, missed }) => ({ topic, label, action, missed: missed || 0 })),
    plan: p,
    totalCorrect: r.totalCorrect,
    totalQuestions: r.totalQuestions,
    peers,
    constants: { passLine: PASS_LINE, readyAt: READY_AT, almostAt: ALMOST_AT, skillFloor: SKILL_FLOOR },
    skillsMeta: Object.fromEntries(Object.entries(SKILLS).map(([k, v]) => [k, { label: v.label, blurb: v.blurb, weight: v.weight }])),
    // The review reveals answers only now, after the learner has submitted.
    review: r.review.map((x) => ({
      id: x.question.id,
      skill: x.question.skill,
      passage: x.question.passage || null,
      prompt: x.question.prompt,
      options: x.question.options,
      choice: x.choice,
      answer: x.question.answer,
      why: x.question.why,
      correct: x.correct,
    })),
  };
}

// ---------- POST /api/score ----------
async function scoreAttempt({ body }) {
  const answers = validateAnswers(body && body.answers);
  if (!answers) return bad(400, "Please answer all questions (choose an option or “I don't know”).");
  let days = null;
  if (body.examDays != null) {
    if (!Number.isInteger(body.examDays) || body.examDays < 0 || body.examDays > 730) return bad(400, "Invalid exam date.");
    days = body.examDays;
  }

  const r = score(answers);
  let attempts = [];
  try { attempts = await loadAttempts(1000); } catch (e) { /* storage is optional */ }
  const result = publicResult(r, plan(r.advice, days), peerStats(r, attempts));

  const id = newId();
  let saved = false;
  try {
    await store.set(`attempt:${id}`, {
      id,
      ts: Date.now(),
      chance: r.chance,
      band: r.band.id,
      skills: Object.fromEntries(Object.values(r.perSkill).map((s) => [s.key, s.score])),
      questions: r.review.map((x) => ({ id: x.question.id, c: x.correct ? 1 : 0, u: x.choice === null ? 1 : 0 })),
      feel: null,
      outcome: null,
      result,
    });
    await store.push(ATTEMPT_LIST, id);
    saved = true;
  } catch (e) { console.error("store failed:", e.message); }

  return ok({ id: saved ? id : null, result });
}

// ---------- GET /api/result?id= ----------
async function getResult({ query }) {
  const id = String(query.id || "");
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return bad(400, "Invalid result link.");
  let a = null;
  try { a = await store.get(`attempt:${id}`); } catch (e) { return bad(503, "Results are temporarily unavailable."); }
  if (!a) return bad(404, "We couldn't find that result.");
  return ok({ id, ts: a.ts, result: a.result, feel: a.feel, outcome: a.outcome });
}

// ---------- POST /api/feedback ----------
async function feedback({ body }) {
  const id = String((body && body.id) || "");
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return bad(400, "Invalid result id.");
  const patch = {};
  if (body.feel != null) {
    if (!FEEL.includes(body.feel)) return bad(400, "Invalid feedback.");
    patch.feel = body.feel;
  }
  if (body.outcome != null) {
    if (!OUTCOME.includes(body.outcome)) return bad(400, "Invalid outcome.");
    patch.outcome = body.outcome;
  }
  if (!Object.keys(patch).length) return bad(400, "Nothing to save.");
  try {
    const a = await store.get(`attempt:${id}`);
    if (!a) return bad(404, "We couldn't find that result.");
    await store.set(`attempt:${id}`, { ...a, ...patch });
  } catch (e) { return bad(503, "Could not save right now."); }
  return ok({ ok: true });
}

// ---------- GET /api/insights ----------
async function insights() {
  let attempts;
  try { attempts = await loadAttempts(2000); } catch (e) { return bad(503, "Insights are temporarily unavailable."); }
  const n = attempts.length;
  const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  const bands = { ready: 0, almost: 0, "not-yet": 0 };
  const feel = { "too-high": 0, "about-right": 0, "too-low": 0 };
  const outcomes = { passed: 0, failed: 0, "not-taken": 0 };
  for (const a of attempts) {
    bands[a.band] = (bands[a.band] || 0) + 1;
    if (a.feel) feel[a.feel] += 1;
    if (a.outcome) outcomes[a.outcome] += 1;
  }

  // Calibration: of learners we gave ~X% chance, how many really passed?
  const buckets = [[0, 25], [25, 50], [50, 75], [75, 100]].map(([lo, hi]) => {
    const inB = attempts.filter((a) => a.chance >= lo && (a.chance < hi || (hi === 100 && a.chance <= 100)));
    const known = inB.filter((a) => a.outcome === "passed" || a.outcome === "failed");
    const passed = known.filter((a) => a.outcome === "passed").length;
    return {
      label: `${lo}–${hi}%`,
      attempts: inB.length,
      reported: known.length,
      predicted: mean(inB.map((a) => a.chance)),
      actual: known.length ? Math.round((passed / known.length) * 100) : null,
    };
  });

  // Question health
  const qstats = QUESTIONS.map((q) => {
    const rows = attempts.map((a) => a.questions.find((x) => x.id === q.id)).filter(Boolean);
    const total = rows.length;
    const pctCorrect = total ? Math.round((rows.reduce((s, r) => s + r.c, 0) / total) * 100) : null;
    const pctUnsure = total ? Math.round((rows.reduce((s, r) => s + r.u, 0) / total) * 100) : null;
    let flag = null;
    if (total >= 20) {
      if (pctCorrect >= 95) flag = "Almost everyone gets this right. It adds little.";
      else if (pctCorrect <= 20) flag = "Almost everyone gets this wrong. Check the wording or the level.";
      else if (pctUnsure >= 40) flag = "Many pick “I don't know”. Learners may not have met this yet.";
    }
    return { id: q.id, skill: q.skill, difficulty: q.difficulty, prompt: q.prompt, attempts: total, pctCorrect, pctUnsure, flag };
  });

  return ok({
    attempts: n,
    storage: { kind: store.kind, persistent: store.persistent },
    bands,
    feel,
    outcomes,
    meanChance: mean(attempts.map((a) => a.chance)),
    meanSkills: Object.fromEntries(Object.keys(SKILLS).map((k) => [k, mean(attempts.map((a) => a.skills[k]))])),
    calibration: buckets,
    questions: qstats,
  });
}

// ---------- adapter: Node (req, res) -> handler ----------
async function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return null; } }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 50_000) return null;
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return null; }
}

function adapt(fn, method) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    const send = (status, json) => { res.statusCode = status; res.end(JSON.stringify(json)); };
    try {
      if (req.method !== method) { res.setHeader("Allow", method); return send(405, { error: "Method not allowed" }); }
      const url = new URL(req.url, "http://localhost");
      const body = method === "POST" ? await readBody(req) : undefined;
      if (method === "POST" && body === null) return send(400, { error: "Invalid request." });
      const out = await fn({ query: Object.fromEntries(url.searchParams), body });
      return send(out.status, out.json);
    } catch (e) {
      console.error(e);
      return send(500, { error: "Something went wrong. Please try again." });
    }
  };
}

module.exports = {
  questions, scoreAttempt, getResult, feedback, insights, adapt,
  routes: {
    questions: adapt(questions, "GET"),
    score: adapt(scoreAttempt, "POST"),
    result: adapt(getResult, "GET"),
    feedback: adapt(feedback, "POST"),
    insights: adapt(insights, "GET"),
  },
};
