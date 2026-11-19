/* Front end: landing -> quiz (one question per screen) -> results. Scoring happens on the server. */
(function () {
  const app = document.getElementById("app");
  const state = { meta: null, i: 0, answers: [], order: [], examDate: "", id: null };
  let questionsPromise = null;
  let keyHandler = null;

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }
  const ICONS = {
    vocabulary: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>',
    grammar: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h13"/></svg>',
    reading: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  };
  function icon(name) {
    const s = h("span", { class: "ico", "aria-hidden": "true" });
    s.innerHTML = ICONS[name] || ""; // constants above only, never user data
    return s;
  }
  function mount(...nodes) {
    clearKeys();
    app.replaceChildren(...nodes.filter(Boolean));
    window.scrollTo(0, 0);
    const first = app.querySelector("h1, .prompt");
    if (first) { first.setAttribute("tabindex", "-1"); first.focus({ preventScroll: true }); }
  }
  function clearKeys() { if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; } }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  async function api(path, body) {
    let res;
    try {
      res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
    } catch (e) { throw new Error("You seem to be offline. Check your connection and try again."); }
    let json = null;
    try { json = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) throw new Error((json && json.error) || "Something went wrong. Please try again.");
    return json;
  }
  const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  function daysUntil(iso) {
    if (!iso) return null;
    const d = Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
    return Number.isFinite(d) && d >= 0 && d <= 730 ? d : null;
  }
  const loadQuestions = () => (questionsPromise = questionsPromise || api("/api/questions").catch((e) => { questionsPromise = null; throw e; }));

  function loading(text) {
    mount(h("div", { class: "loading" }, h("div", { class: "spinner" }), h("p", {}, text)));
  }
  function failure(message, retry, label) {
    mount(h("div", { class: "card" },
      h("h2", {}, "We couldn't do that"),
      h("div", { class: "error", role: "alert" }, message),
      h("div", { class: "row" },
        retry && h("button", { class: "btn", onclick: retry }, label || "Try again"),
        h("button", { class: "btn ghost", onclick: landing }, "Back to start"))));
  }

  // ---------- landing ----------
  function landing() {
    history.replaceState(null, "", location.pathname);
    loadQuestions().catch(() => {}); // warm up
    const date = h("input", { type: "date", id: "exam-date", min: todayISO(), value: state.examDate });
    date.addEventListener("change", () => { state.examDate = date.value; });

    const mini = (label, pct) => h("div", { class: "mini-skill" }, h("span", {}, label), h("div", { class: "t" }, h("i", { style: `width:${pct}%` })), h("b", {}, `${pct}%`));

    mount(
      h("section", { class: "hero-land" },
        h("span", { class: "eyebrow-chip" }, "Goethe A1 · ÖSD A1"),
        h("h1", {}, "Know if you'll pass ", h("em", {}, "before"), " you pay for the exam."),
        h("p", { class: "lede" }, "15 short questions. In about 8 minutes you get your chance of passing, the A1 skills you've already shown, and a plan for what to practise first."),
        h("div", { class: "field" },
          h("label", { for: "exam-date" }, "Exam date ", h("span", { class: "muted" }, "(optional, builds your plan)")),
          date),
        h("div", { class: "row", style: "margin-top:14px" },
          h("button", { class: "btn", onclick: begin }, "Start the check →")),
        h("p", { class: "cta-note" }, "Free · no sign-up · works on your phone")),
      h("div", { class: "card preview", "aria-hidden": "true" },
        h("span", { class: "tagline" }, "Example result"),
        h("div", { class: "preview-grid" },
          h("div", { class: "num" }, "62%", h("small", {}, "chance of passing")),
          h("div", {}, mini("Vocabulary", 80), mini("Grammar", 55), mini("Reading", 60)))),
      h("div", { class: "steps" },
        h("div", { class: "step" }, h("div", { class: "n" }, "1"), h("h3", {}, "Answer 15 questions"), h("p", {}, "Vocabulary, grammar and reading, like the real exam.")),
        h("div", { class: "step" }, h("div", { class: "n" }, "2"), h("h3", {}, "See your chance"), h("p", {}, "A clear book / wait decision, with an honest range.")),
        h("div", { class: "step" }, h("div", { class: "n" }, "3"), h("h3", {}, "Follow your plan"), h("p", {}, "The 2–3 things to practise, day by day until your exam."))),
      h("div", { class: "card" },
        h("h2", {}, "Why you can trust it"),
        h("ul", { class: "trust" },
          h("li", {}, "Built on the real rule: Goethe A1 is passed with at least 60% of the points."),
          h("li", {}, "It shows how sure it is. Short tests are noisy, so you see a range, not a fake exact score."),
          h("li", {}, "It checks itself: learners report how the real exam went, and we compare that with what we predicted."))));
  }

  // ---------- quiz ----------
  async function begin() {
    loading("Getting your questions…");
    try { state.meta = await loadQuestions(); } catch (e) { return failure(e.message, begin); }
    state.i = 0;
    state.answers = new Array(state.meta.questions.length).fill(undefined);
    state.order = state.meta.questions.map((q) => shuffle(q.options.map((_, idx) => idx)));
    state.id = null;
    question();
  }

  function question() {
    const { questions, skills } = state.meta;
    const q = questions[state.i];
    const total = questions.length;
    const saved = state.answers[state.i];
    const isLast = state.i === total - 1;
    let selected = saved;

    const next = h("button", { class: "btn", disabled: saved === undefined, onclick: advance }, isLast ? "See my result" : "Next");
    const labels = [];

    function select(value) {
      selected = value;
      state.answers[state.i] = value;
      next.disabled = false;
      labels.forEach((l) => l.el.classList.toggle("selected", l.value === value));
    }
    function option(value, text, keyLabel, extra) {
      const input = h("input", { type: "radio", name: "q" + q.id, value: String(value), checked: saved === value });
      const el = h("label", { class: "opt" + (extra ? " " + extra : "") + (saved === value ? " selected" : "") },
        input, h("span", { class: "key", "aria-hidden": "true" }, keyLabel), h("span", {}, text));
      input.addEventListener("change", () => select(value));
      labels.push({ el, value });
      return el;
    }

    const opts = state.order[state.i].map((orig, pos) => option(orig, q.options[orig], String(pos + 1)));
    const unsure = option(null, "I don't know", "0", "unsure");

    // 3-segment progress: vocabulary / grammar / reading
    const segs = Object.keys(skills).map((key) => {
      const idx = questions.map((x, n) => (x.skill === key ? n : -1)).filter((n) => n >= 0);
      const done = idx.filter((n) => n < state.i).length;
      return h("div", { class: "seg" + (q.skill === key ? " active" : "") },
        h("div", { class: "lab" }, icon(key), skills[key].label),
        h("div", { class: "track" }, h("i", { style: `width:${(done / idx.length) * 100}%` })));
    });

    mount(
      h("div", { class: "quiz-top" }, h("span", {}, `Question ${state.i + 1} of ${total}`), h("span", { class: "hint" }, "Keys 1–4 to choose · 0 for “I don't know” · Enter for next")),
      h("div", { class: "segments" }, segs),
      h("div", { class: "card qcard" },
        q.passage && h("p", { class: "passage", lang: "de" }, q.passage),
        h("p", { class: "prompt", lang: "de" }, q.prompt),
        h("fieldset", { role: "radiogroup", "aria-label": "Answer options" }, opts, unsure),
        h("div", { class: "row between" },
          state.i > 0 ? h("button", { class: "btn ghost", onclick: back }, "← Back") : h("span"),
          next)));

    keyHandler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key) && opts[Number(e.key) - 1]) { opts[Number(e.key) - 1].querySelector("input").click(); }
      else if (e.key === "0") unsure.querySelector("input").click();
      else if (e.key === "Enter" && selected !== undefined && document.activeElement.tagName !== "BUTTON") advance();
    };
    document.addEventListener("keydown", keyHandler);
  }

  function back() { if (state.i > 0) { state.i -= 1; question(); } }
  function advance() {
    if (state.answers[state.i] === undefined) return;
    if (state.i < state.meta.questions.length - 1) { state.i += 1; question(); }
    else submit();
  }

  async function submit() {
    loading("Working out your result…");
    const body = {
      answers: state.meta.questions.map((q, n) => ({ id: q.id, choice: state.answers[n] === undefined ? null : state.answers[n] })),
    };
    const d = daysUntil(state.examDate);
    if (d !== null) body.examDays = d;
    try {
      const out = await api("/api/score", body);
      state.id = out.id;
      if (out.id) history.replaceState(null, "", `?r=${out.id}`);
      results(out.result, { id: out.id, fresh: true, daysLeft: d });
    } catch (e) { failure(e.message, submit, "Try again"); }
  }

  async function openSaved(id) {
    loading("Opening your result…");
    try {
      const out = await api("/api/result?id=" + encodeURIComponent(id));
      state.id = out.id;
      results(out.result, { id: out.id, fresh: false, ts: out.ts, feel: out.feel, outcome: out.outcome, daysLeft: null });
    } catch (e) { failure(e.message, null); }
  }

  // ---------- results ----------
  function results(r, ctx) {
    const c = r.constants;
    const tone = (s) => (s >= 75 ? "good" : s >= 50 ? "warn" : "bad");
    const mark = { yes: ["✓", "Shown"], partial: ["◐", "Partly"], no: ["○", "Not yet"] };

    let verdict = {
      ready: "The odds are in your favour. Do one timed mock exam to be sure, then book.",
      almost: "You could pass, but it isn't safe yet. A short, focused push on the points below should fix that.",
      "not-yet": "Booking today would put your exam fee and your timeline at risk. Practise the points below first, then check again.",
    }[r.band.id];
    if (r.weakSkillCapped) verdict = "Your overall odds look good, but one skill is very weak. Fix that first, then book.";

    const zone = (cls, flex, text) => text ? h("span", { class: cls, style: `flex:${flex}` }, text) : h("div", { class: "zone " + cls, style: `flex:${flex}` });
    const strip = h("div", { class: "zonewrap" },
      h("div", { class: "zones", role: "img", "aria-label": `Chance of passing ${r.chance} percent, ${r.band.label}` },
        zone("bad", c.almostAt), zone("warn", c.readyAt - c.almostAt), zone("good", 100 - c.readyAt),
        h("div", { class: "pin", style: `left:${r.chance}%` })),
      h("div", { class: "zone-labels", "aria-hidden": "true" },
        zone("bad", c.almostAt, "Not yet"), zone("warn", c.readyAt - c.almostAt, "Almost"), zone("good", 100 - c.readyAt, "Ready")));

    const banner = !ctx.fresh && ctx.ts
      ? h("div", { class: "saved-banner" }, "Saved result from " + new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(ctx.ts))) : null;

    const hero = h("div", { class: `card hero ${r.band.tone}` },
      h("p", { class: "eyebrow" }, "If you booked the exam today, your chance of passing is about"),
      h("div", { class: "big" }, `${r.chance}%`),
      h("span", { class: `pill ${r.band.tone}` }, r.band.label),
      strip,
      h("p", { class: "verdict" }, verdict),
      h("p", { class: "muted small" }, `You answered ${r.totalCorrect} of ${r.totalQuestions} correctly. Your true level is probably between ${r.range.low}% and ${r.range.high}%, and the pass mark is ${Math.round(c.passLine * 100)}%.`));

    const skills = h("div", { class: "card" },
      h("h2", {}, "By skill"),
      r.weakSkillCapped && h("div", { class: "note" }, `${r.skillsMeta[r.weakestSkill].label} is below ${c.skillFloor}%. Listening, writing and speaking lean on the same words and grammar, so a gap here can hurt you across the exam.`),
      Object.values(r.perSkill).map((s) =>
        h("div", { class: "skill" },
          h("div", { class: "skill-head" }, h("span", {}, s.label), h("span", {}, `${s.score}%`)),
          h("div", { class: "meter", role: "img", "aria-label": `${s.label}: ${s.score} percent, likely range ${s.low} to ${s.high}` },
            h("div", { class: `range ${tone(s.score)}`, style: `left:${s.low}%;width:${Math.max(2, s.high - s.low)}%` }),
            h("div", { class: `dot ${tone(s.score)}`, style: `left:${s.score}%` }),
            h("div", { class: "mark", style: `left:${c.passLine * 100}%`, title: "Pass mark (60%)" })),
          h("p", { class: "muted small" }, `${s.correct}/${s.count} correct` + (s.unsure ? ` · ${s.unsure} “I don't know”` : "") + ` · likely range ${s.low}–${s.high}%`))),
      h("p", { class: "muted small" }, "The dot is your score. The shaded bar is where your true level probably is (only 5 questions per skill). The line is the 60% pass mark."));

    const peers = r.peers ? h("div", { class: "card" },
      h("h2", {}, "How you compare"),
      h("p", { class: "muted small" }, `Based on ${r.peers.n} learners who took this check before you.`),
      h("div", { class: "peers" },
        h("div", {}, h("span", {}, "Overall"), h("strong", {}, `Higher than ${r.peers.overall}%`)),
        Object.entries(r.peers.skills).map(([k, v]) => h("div", {}, h("span", {}, r.skillsMeta[k].label), h("strong", {}, `Higher than ${v}%`))))) : null;

    const markers = h("div", { class: "card" },
      h("h2", {}, "Your A1 markers"),
      h("p", { class: "muted small" }, "Real A1 ability in plain words: things you should be able to do on exam day."),
      h("ul", { class: "markers" }, r.markers.map((m) =>
        h("li", { class: m.status },
          h("span", { class: "mk", "aria-hidden": "true" }, mark[m.status][0]),
          h("span", {}, h("strong", {}, "I can: "), m.canDo.replace(/^I can /, ""), h("span", { class: "sr" }, ` (${mark[m.status][1]})`))))));

    const advice = h("div", { class: "card" },
      h("h2", {}, "Practise this before you book"),
      h("ol", { class: "advice" }, r.advice.map((a) => h("li", {}, h("div", {}, h("h3", {}, a.label), h("p", { class: "muted" }, a.action))))));

    let planCard = null;
    if (r.plan) {
      const dl = ctx.daysLeft;
      const intro = dl == null ? "No exam date set, so here is a 2-week plan (about 30 minutes a day)."
        : dl === 0 ? "Your exam is today. If you can still move it, think about that. Otherwise, revise the points above."
        : `Your exam is in ${dl} day${dl === 1 ? "" : "s"}. About 30 minutes a day:`;
      planCard = h("div", { class: "card" },
        h("h2", {}, "Your plan"),
        !ctx.fresh ? h("p", { class: "muted" }, "From when you took the check (about 30 minutes a day):") : h("p", { class: "muted" }, intro),
        h("ul", { class: "plan" },
          r.plan.steps.map((s) => h("li", {}, h("strong", {}, s.from === s.to ? `Day ${s.from}` : `Days ${s.from}–${s.to}`), ": ", s.label)),
          h("li", {}, h("strong", {}, `Day ${r.plan.retakeDay}`), ": retake this check and compare")));
    }

    const how = h("details", { class: "card how" },
      h("summary", {}, "How we decided"),
      h("p", {}, "Passing the real exam (Goethe A1 Start Deutsch 1) needs about 60% of the total points. So we ask a direct question: given your answers, how likely is your true level to be at or above 60%?"),
      h("ul", { class: "list" },
        h("li", {}, "Hard questions count 3 points, medium 2, easy 1. “I don't know” counts as wrong."),
        h("li", {}, "Reading counts 40%, grammar 30%, vocabulary 30%."),
        h("li", {}, "Only 5 questions per skill means real uncertainty, so we estimate a range and turn it into a chance of passing."),
        h("li", {}, `We only say “Ready” at ${c.readyAt}% or more, because a wrong “ready” costs an exam fee and months. A skill under ${c.skillFloor}% also blocks “Ready”.`),
        h("li", {}, "These cut-offs are our best estimate. We tune them using what learners tell us about their real exam.")));

    const review = h("div", { class: "card" },
      h("h2", {}, "Review your answers"),
      r.review.map((x, idx) => h("details", { class: "rev" },
        h("summary", {}, `${idx + 1}. `, h("span", { class: x.correct ? "ok" : "no" }, x.correct ? "✓ " : "✗ "), x.prompt),
        h("div", { class: "res" },
          !x.correct && h("p", {}, "Your answer: ", x.choice === null ? "I don't know" : x.options[x.choice]),
          h("p", {}, "Correct answer: ", h("strong", {}, x.options[x.answer])),
          h("p", { class: "muted" }, x.why)))));

    // Help us check the score: this is the feedback loop
    const status = h("p", { class: "muted small", role: "status" });
    function choiceGroup(title, items, key, current) {
      const group = h("div", { class: "fb-group" }, h("h3", {}, title));
      items.forEach(([value, label]) => {
        const b = h("button", { class: "btn ghost small", "aria-pressed": String(current === value), onclick: async () => {
          try {
            await api("/api/feedback", { id: ctx.id, [key]: value });
            group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            status.textContent = "Thank you! This helps us check how accurate the result is.";
          } catch (e) { status.textContent = e.message; }
        } }, label);
        group.append(b);
      });
      return group;
    }
    const share = ctx.id ? h("div", { class: "card" },
      h("h2", {}, "Save this result"),
      h("p", { class: "muted small" }, "Keep this link. Open it again after your exam to tell us how it went."),
      (() => {
        const url = `${location.origin}${location.pathname}?r=${ctx.id}`;
        const input = h("input", { type: "text", readonly: true, value: url, "aria-label": "Link to your result" });
        const copy = h("button", { class: "btn small", onclick: async () => {
          try { await navigator.clipboard.writeText(url); copy.textContent = "Copied ✓"; }
          catch (e) { input.select(); copy.textContent = "Press Ctrl/⌘+C"; }
        } }, "Copy link");
        return h("div", { class: "sharebox" }, input, copy);
      })()) : null;

    const help = ctx.id ? h("div", { class: "card" },
      h("h2", {}, "Help us check this score"),
      h("p", { class: "muted small" }, "A readiness score is only useful if it matches what really happens. Two quick taps make it better for the next learner."),
      choiceGroup("Does this result feel right?", [["too-high", "Too high"], ["about-right", "About right"], ["too-low", "Too low"]], "feel", ctx.feel),
      choiceGroup("Already took the real exam?", [["passed", "I passed"], ["failed", "I didn't pass"], ["not-taken", "Not yet"]], "outcome", ctx.outcome),
      status) : null;

    const caveat = h("p", { class: "muted small" }, "This is an estimate from 15 questions, not an official result. It covers vocabulary, grammar and reading only. The real exam also tests listening, writing and speaking.");

    mount(banner, hero, skills, peers, markers, advice, planCard, how, review, share, help, caveat,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: landing }, "Retake the check")));
  }

  // ---------- boot ----------
  const savedId = new URLSearchParams(location.search).get("r");
  if (savedId) openSaved(savedId); else landing();
})();
