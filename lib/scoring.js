/*
 * How "ready" is decided  (pure functions, no DOM, unit-tested in scoring.test.js)
 *
 * The question a learner really has is: "If I book the exam today, will I pass?"
 * So instead of an arbitrary score, we estimate the CHANCE OF PASSING.
 *
 *  1. Evidence      Each question is a piece of evidence, weighted by difficulty
 *                   (easy 1, medium 2, hard 3). "I don't know" counts as wrong.
 *  2. Skill ability Per skill we estimate the learner's true accuracy with a Beta posterior
 *                   (a uniform prior + the observed results). With only 5 questions per skill the
 *                   estimate is wide, and we show that range instead of pretending to be exact.
 *  3. Overall       Exam weights: reading 40%, grammar 30%, vocabulary 30%. The overall estimate
 *                   and its uncertainty come from combining the skills.
 *  4. Chance        P(true overall ability >= 60%). The Goethe A1 (Start Deutsch 1) pass mark is
 *                   60% of total points. The same line is used here: this is an assumption to
 *                   calibrate with real exam results in v2.
 *  5. Decision      >= 85% chance  -> Ready to book
 *                   60-84%         -> Almost ready
 *                   < 60%          -> Not ready yet
 *                   Safety rule (my design choice, not an exam rule): a skill under 40% blocks
 *                   "Ready", because listening, writing and speaking (not tested here) lean on the
 *                   same vocabulary and grammar.
 *  6. Markers       Topics become "I can..." statements (CEFR can-do style): shown / partly / not yet.
 *  7. Advice        Topics ranked by missed points; the top 3 become "practise this".
 */
(function (root) {
  const D = typeof require !== "undefined" ? require("./questions.js") : root.GlobioData;
  const { SKILLS, TOPICS, QUESTIONS } = D;

  const PASS_LINE = 0.6;      // share of total points needed to pass
  const READY_AT = 85;        // % chance of passing
  const ALMOST_AT = 60;
  const SKILL_FLOOR = 40;     // % skill score below which "Ready" is blocked
  const Z80 = 1.2816;         // 80% interval

  const GENERIC_ADVICE = [
    {
      topic: "mock-exam",
      label: "Take a full timed mock exam",
      action:
        "Do one complete Goethe/ÖSD A1 sample paper under exam conditions (same time limit, no dictionary). If you pass it comfortably, you are in good shape to book.",
    },
    {
      topic: "other-modules",
      label: "Practise what this check cannot test",
      action:
        "This check covers vocabulary, grammar and reading only. The real exam also tests listening, writing and speaking, so practise those too, for example by recording yourself introducing yourself and ordering food.",
    },
  ];

  // Standard normal CDF (Abramowitz & Stegun 7.1.26)
  function phi(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x >= 0 ? 1 - p : p;
  }

  function band(chance, floorBlocked) {
    if (chance >= READY_AT && !floorBlocked) return { id: "ready", label: "Ready to book", tone: "good" };
    if (chance >= ALMOST_AT) return { id: "almost", label: "Almost ready", tone: "warn" };
    return { id: "not-yet", label: "Not ready yet", tone: "bad" };
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const pct = (x) => Math.round(clamp01(x) * 100);

  /**
   * @param {{id:string, choice:number|null}[]} answers  choice = option index, null = "I don't know"
   * @param {object[]} questions  defaults to the full bank
   */
  function score(answers, questions = QUESTIONS) {
    const byId = new Map(answers.map((a) => [a.id, a.choice]));
    const acc = {};
    for (const key of Object.keys(SKILLS)) acc[key] = { earned: 0, total: 0, correct: 0, count: 0, unsure: 0 };
    const missedByTopic = {};
    const topicStats = {};
    const review = [];

    for (const q of questions) {
      const choice = byId.has(q.id) ? byId.get(q.id) : null;
      const s = acc[q.skill];
      const correct = choice === q.answer;
      s.total += q.difficulty;
      s.count += 1;
      if (choice === null) s.unsure += 1;
      const t = (topicStats[q.topic] = topicStats[q.topic] || { correct: 0, total: 0 });
      t.total += 1;
      if (correct) {
        s.earned += q.difficulty;
        s.correct += 1;
        t.correct += 1;
      } else {
        missedByTopic[q.topic] = (missedByTopic[q.topic] || 0) + q.difficulty;
      }
      review.push({ question: q, choice, correct });
    }

    // Per-skill Beta posterior and 80% range
    const perSkill = {};
    let mean = 0;
    let variance = 0;
    for (const [key, s] of Object.entries(acc)) {
      const raw = s.total ? s.earned / s.total : 0;
      const a = 1 + raw * s.count;
      const b = 1 + (1 - raw) * s.count;
      const m = a / (a + b);
      const v = (a * b) / ((a + b) * (a + b) * (a + b + 1));
      const sd = Math.sqrt(v);
      const w = SKILLS[key].weight;
      mean += w * m;
      variance += w * w * v;
      perSkill[key] = {
        key,
        label: SKILLS[key].label,
        score: Math.round(raw * 100),
        low: pct(m - Z80 * sd),
        high: pct(m + Z80 * sd),
        correct: s.correct,
        count: s.count,
        unsure: s.unsure,
      };
    }
    const sd = Math.sqrt(variance);
    const chanceRaw = 1 - phi((PASS_LINE - mean) / sd);
    const chance = Math.max(1, Math.min(99, Math.round(chanceRaw * 100)));

    const weakest = Object.values(perSkill).reduce((a, b) => (b.score < a.score ? b : a));
    const floorBlocked = weakest.score < SKILL_FLOOR;
    const b = band(chance, floorBlocked);
    const weakSkillCapped = floorBlocked && chance >= READY_AT;

    const markers = Object.entries(topicStats).map(([topic, t]) => ({
      topic,
      label: TOPICS[topic].label,
      canDo: TOPICS[topic].canDo,
      correct: t.correct,
      total: t.total,
      status: t.correct === t.total ? "yes" : t.correct === 0 ? "no" : "partial",
    }));

    const advice = Object.entries(missedByTopic)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([topic, missed]) => ({ topic, label: TOPICS[topic].label, action: TOPICS[topic].action, missed }));
    for (const g of GENERIC_ADVICE) {
      if (advice.length >= 2) break;
      advice.push(g);
    }

    const totalCorrect = review.filter((r) => r.correct).length;
    return {
      chance,
      band: b,
      expected: pct(mean),
      range: { low: pct(mean - Z80 * sd), high: pct(mean + Z80 * sd) },
      weakestSkill: weakest.key,
      weakSkillCapped,
      perSkill,
      markers,
      advice,
      review,
      totalCorrect,
      totalQuestions: questions.length,
    };
  }

  /**
   * Simple study plan from the advice list and the days left (null = no exam date given).
   * The last day is kept free for a re-check. Never overlaps days, even when the exam is close.
   */
  function plan(advice, daysLeft) {
    let topics = advice.filter((a) => a.missed).map((a) => a.label);
    if (!topics.length) return null;
    const days = daysLeft == null ? 14 : Math.max(1, daysLeft);
    const studyDays = Math.max(1, days - 1);
    topics = topics.slice(0, studyDays);
    const base = Math.floor(studyDays / topics.length);
    let extra = studyDays % topics.length;
    let day = 1;
    const steps = topics.map((label) => {
      const len = base + (extra-- > 0 ? 1 : 0);
      const step = { from: day, to: day + len - 1, label };
      day += len;
      return step;
    });
    return { days, steps, retakeDay: days };
  }

  const api = { score, plan, band, phi, PASS_LINE, READY_AT, ALMOST_AT, SKILL_FLOOR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GlobioScoring = api;
})(typeof window !== "undefined" ? window : globalThis);
