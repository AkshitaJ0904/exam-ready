/*
 * Question bank for the "Am I exam-ready?" check.
 *
 * Target: a learner who has finished A1 and is about to book Goethe-Zertifikat A1
 * (Start Deutsch 1) or ÖSD A1. Questions are mostly A1, with a few "stretch"
 * items (difficulty 3) so the score separates "just passed A1" from "solid A1".
 *
 * Fields
 *   skill      vocabulary | grammar | reading
 *   difficulty 1 (easy) | 2 (medium) | 3 (hard)  -> used as the question's weight
 *   topic      key into TOPICS below; used to build the "practise this" advice
 *   passage    (reading only) text shown above the question
 *   answer     index of the correct option in `options`
 *   why        one-line explanation shown in the review
 */
(function (root) {
  const SKILLS = {
    vocabulary: { label: "Vocabulary", weight: 0.3, blurb: "Words you need in everyday situations" },
    grammar: { label: "Grammar", weight: 0.3, blurb: "Verb forms, cases and sentence building" },
    reading: { label: "Reading", weight: 0.4, blurb: "Understanding short real-life texts" },
  };

  // Each topic maps to concrete, doable practice advice.
  const TOPICS = {
    "everyday-words": {
      label: "Everyday words (food, family, shops)",
      action:
        "Revise A1 word lists for food & drink, family and shops. Learn every noun together with its article (der/die/das), and test yourself with flashcards for 10 minutes a day.",
    },
    "time-travel": {
      label: "Time, clock and travel words",
      action:
        "Practise telling the time in German (Viertel vor/nach, halb) and the travel words you meet on trains and at stations (Verspätung, Gleis, Fahrkarte). Say 10 times out loud each day.",
    },
    "verb-forms": {
      label: "Verb endings (ich komme, er kommt)",
      action:
        "Drill present-tense endings for regular verbs and for sein/haben. Write 5 sentences about yourself every day, changing the subject (ich, du, er, wir).",
    },
    cases: {
      label: "Articles and cases (Akkusativ / Dativ)",
      action:
        "Learn the Akkusativ articles (einen/eine/ein) and the Dativ after mit, bei, zu, von (mit dem Bus). Do 15 gap-fill exercises on each case.",
    },
    "word-order": {
      label: "Word order and separable verbs",
      action:
        "Practise 'the verb is always in position 2' and separable verbs (aufstehen → ich stehe auf). Re-order jumbled sentences until it feels automatic.",
    },
    "reading-messages": {
      label: "Reading short messages and emails",
      action:
        "Read 3 short A1 messages or emails a day (Goethe sample papers are free). Underline who / what / when before you look at the questions.",
    },
    "reading-signs": {
      label: "Reading signs, notices and opening times",
      action:
        "Practise reading notices, timetables and opening hours. Focus on days, times and words like geöffnet, geschlossen, nur, ab, bis.",
    },
    "reading-ads": {
      label: "Reading ads and drawing conclusions",
      action:
        "Practise reading ads (flats, jobs, events) and deciding whether a person's situation matches. Look for the 'rules' words: nicht erlaubt, ohne, mit, ab.",
    },
  };

  const QUESTIONS = [
    // ---------------- Vocabulary ----------------
    {
      id: "v1", skill: "vocabulary", difficulty: 1, topic: "everyday-words",
      prompt: "Ich trinke jeden Morgen einen ___.",
      options: ["Kaffee", "Brot", "Apfel", "Tisch"], answer: 0,
      why: "You drink (trinken) Kaffee. Brot and Apfel are eaten; a Tisch is furniture.",
    },
    {
      id: "v2", skill: "vocabulary", difficulty: 1, topic: "everyday-words",
      prompt: "Die Schwester meiner Mutter ist meine ___.",
      options: ["Oma", "Tante", "Nichte", "Cousine"], answer: 1,
      why: "Your mother's sister is your Tante (aunt).",
    },
    {
      id: "v3", skill: "vocabulary", difficulty: 2, topic: "everyday-words",
      prompt: "Ich habe Kopfschmerzen und brauche Tabletten. Ich gehe in die ___.",
      options: ["Bäckerei", "Apotheke", "Metzgerei", "Buchhandlung"], answer: 1,
      why: "Medicine is sold in the Apotheke (pharmacy).",
    },
    {
      id: "v4", skill: "vocabulary", difficulty: 2, topic: "time-travel",
      prompt: "Es ist 7:45 Uhr. Wie sagt man das?",
      options: ["Viertel nach sieben", "Halb acht", "Viertel vor acht", "Viertel nach acht"], answer: 2,
      why: "7:45 is a quarter to eight: Viertel vor acht. (Halb acht is 7:30.)",
    },
    {
      id: "v5", skill: "vocabulary", difficulty: 3, topic: "time-travel",
      prompt: "Der Zug hat 20 Minuten Verspätung. Das bedeutet: Der Zug kommt ___.",
      options: ["20 Minuten früher", "pünktlich", "nicht", "20 Minuten später"], answer: 3,
      why: "Verspätung means delay, so the train arrives 20 minutes later.",
    },

    // ---------------- Grammar ----------------
    {
      id: "g1", skill: "grammar", difficulty: 1, topic: "verb-forms",
      prompt: "Er ___ aus Indien.",
      options: ["komme", "kommst", "kommt", "kommen"], answer: 2,
      why: "With er/sie/es the verb ends in -t: er kommt.",
    },
    {
      id: "g2", skill: "grammar", difficulty: 2, topic: "cases",
      prompt: "Ich habe ___ Hund.",
      options: ["ein", "einen", "eine", "einem"], answer: 1,
      why: "'haben' takes the Akkusativ, and der Hund is masculine, so ein → einen.",
    },
    {
      id: "g3", skill: "grammar", difficulty: 2, topic: "word-order",
      prompt: "Welcher Satz ist richtig?",
      options: [
        "Morgen ich gehe zur Arbeit.",
        "Morgen gehe ich zur Arbeit.",
        "Morgen gehe zur Arbeit ich.",
        "Ich morgen gehe zur Arbeit.",
      ], answer: 1,
      why: "The conjugated verb is always in position 2. 'Morgen' is position 1, so 'gehe' comes next.",
    },
    {
      id: "g4", skill: "grammar", difficulty: 2, topic: "word-order",
      prompt: "Welcher Satz ist richtig?",
      options: [
        "Ich aufstehe um 6 Uhr.",
        "Ich stehe um auf 6 Uhr.",
        "Ich stehe um 6 Uhr auf.",
        "Ich auf stehe um 6 Uhr.",
      ], answer: 2,
      why: "aufstehen is separable: the verb goes to position 2 and 'auf' goes to the end.",
    },
    {
      id: "g5", skill: "grammar", difficulty: 3, topic: "cases",
      prompt: "Ich fahre jeden Tag mit ___ Bus zur Arbeit.",
      options: ["der", "den", "das", "dem"], answer: 3,
      why: "'mit' always takes the Dativ. der Bus is masculine, so the Dativ article is 'dem'.",
    },

    // ---------------- Reading ----------------
    {
      id: "r1", skill: "reading", difficulty: 1, topic: "reading-messages",
      passage:
        "Hallo Anna,\nich bin heute leider krank und kann nicht zum Deutschkurs kommen. Kannst du mir bitte die Hausaufgaben schicken? Morgen komme ich wieder.\nDanke! Ravi",
      prompt: "Warum kommt Ravi heute nicht zum Kurs?",
      options: ["Er hat keine Zeit.", "Er ist krank.", "Er ist im Urlaub.", "Er hat Hausaufgaben."], answer: 1,
      why: "'ich bin heute leider krank' – Ravi is ill.",
    },
    {
      id: "r2", skill: "reading", difficulty: 2, topic: "reading-messages",
      passage:
        "Hallo Anna,\nich bin heute leider krank und kann nicht zum Deutschkurs kommen. Kannst du mir bitte die Hausaufgaben schicken? Morgen komme ich wieder.\nDanke! Ravi",
      prompt: "Was soll Anna tun?",
      options: [
        "Ravi besuchen",
        "Ravi anrufen",
        "Ravi die Hausaufgaben schicken",
        "Die Lehrerin fragen",
      ], answer: 2,
      why: "'Kannst du mir bitte die Hausaufgaben schicken?' – Ravi asks Anna to send the homework.",
    },
    {
      id: "r3", skill: "reading", difficulty: 2, topic: "reading-signs",
      passage:
        "STADTBIBLIOTHEK\nÖffnungszeiten:\nMontag – Freitag: 9:00 – 18:00 Uhr\nSamstag: 10:00 – 14:00 Uhr\nSonntag: geschlossen\nBitte Handy leise stellen.",
      prompt: "Es ist Samstag, 15 Uhr. Kannst du in die Bibliothek gehen?",
      options: [
        "Ja, sie ist bis 18 Uhr offen.",
        "Nein, samstags ist sie nur bis 14 Uhr offen.",
        "Nein, samstags ist sie geschlossen.",
        "Ja, aber nur bis 16 Uhr.",
      ], answer: 1,
      why: "Saturday hours are 10:00–14:00, so at 15:00 it is already closed.",
    },
    {
      id: "r4", skill: "reading", difficulty: 2, topic: "reading-ads",
      passage:
        "ZU VERMIETEN\n2-Zimmer-Wohnung, 55 m², 3. Stock, mit Balkon, kein Aufzug.\nMiete: 650 € warm.\nFrei ab 1. Dezember. Haustiere nicht erlaubt.\nTel. 0151 234567",
      prompt: "Was stimmt?",
      options: [
        "Die Wohnung hat einen Aufzug.",
        "Die Wohnung hat keinen Aufzug.",
        "Die Miete ist 650 € kalt.",
        "Die Wohnung ist schon frei.",
      ], answer: 1,
      why: "'kein Aufzug' means there is no lift. 'warm' means utilities are included, and it is free only from 1 December.",
    },
    {
      id: "r5", skill: "reading", difficulty: 3, topic: "reading-ads",
      passage:
        "ZU VERMIETEN\n2-Zimmer-Wohnung, 55 m², 3. Stock, mit Balkon, kein Aufzug.\nMiete: 650 € warm.\nFrei ab 1. Dezember. Haustiere nicht erlaubt.\nTel. 0151 234567",
      prompt: "Maria hat eine Katze und sucht ab Januar eine Wohnung. Passt die Anzeige?",
      options: [
        "Ja, die Wohnung passt.",
        "Nein, die Wohnung ist zu klein.",
        "Nein, Haustiere sind nicht erlaubt.",
        "Nein, die Wohnung ist erst ab Februar frei.",
      ], answer: 2,
      why: "Maria has a cat (Haustier), and the ad says 'Haustiere nicht erlaubt'.",
    },
  ];

  // Readiness MARKERS: plain-language "I can..." statements in the style of the CEFR A1 can-do
  // descriptors. Each topic is one marker; the learner sees which ones they have shown evidence for.
  const CAN_DO = {
    "everyday-words": "I can name common food, family members and shops.",
    "time-travel": "I can tell the time and understand basic travel words.",
    "verb-forms": "I can use the right verb ending with ich, du, er and wir.",
    cases: "I can use der/die/das and ein/einen/einem correctly after common verbs and prepositions.",
    "word-order": "I can build simple sentences with the verb in the right place, including separable verbs.",
    "reading-messages": "I can understand a short personal message.",
    "reading-signs": "I can read notices and opening times.",
    "reading-ads": "I can understand a short ad and tell whether it fits a person's needs.",
  };
  for (const k of Object.keys(TOPICS)) TOPICS[k].canDo = CAN_DO[k];

  const api = { SKILLS, TOPICS, QUESTIONS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GlobioData = api;
})(typeof window !== "undefined" ? window : globalThis);
