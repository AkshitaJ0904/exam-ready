/*
 * Tiny storage layer with two backends, chosen by environment:
 *   - Redis over REST (Upstash, e.g. from the Vercel Marketplace) when KV_REST_API_URL/TOKEN
 *     (or UPSTASH_REDIS_REST_URL/TOKEN) are set. This is what production should use.
 *   - A JSON file otherwise: ./data/store.json locally, or the OS temp dir on a serverless host
 *     (temporary there, so attempts can vanish between cold starts).
 *
 * Interface: set(key, value), get(key), mget(keys), push(list, value), range(list, n)
 * Scoring never depends on storage: callers catch errors and carry on.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST_CAP = 5000;

function redisStore() {
  async function cmd(args) {
    const res = await fetch(REST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.result;
  }
  const parse = (s) => (s == null ? null : JSON.parse(s));
  return {
    kind: "redis",
    persistent: true,
    async set(key, value) { await cmd(["SET", key, JSON.stringify(value)]); },
    async get(key) { return parse(await cmd(["GET", key])); },
    async mget(keys) { return keys.length ? (await cmd(["MGET", ...keys])).map(parse) : []; },
    async push(list, value) {
      await cmd(["LPUSH", list, String(value)]);
      await cmd(["LTRIM", list, 0, LIST_CAP - 1]);
    },
    async range(list, n) { return cmd(["LRANGE", list, 0, n - 1]); },
  };
}

function fileStore() {
  const onServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const file = process.env.EXAM_READY_STORE_FILE || (onServerless
    ? path.join(os.tmpdir(), "exam-ready-store.json")
    : path.join(__dirname, "..", "data", "store.json"));
  function load() {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { kv: {}, lists: {} }; }
  }
  function save(db) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db));
  }
  return {
    kind: onServerless ? "tmp-file" : "file",
    persistent: !onServerless,
    async set(key, value) { const db = load(); db.kv[key] = value; save(db); },
    async get(key) { return load().kv[key] ?? null; },
    async mget(keys) { const db = load(); return keys.map((k) => db.kv[k] ?? null); },
    async push(list, value) {
      const db = load();
      db.lists[list] = [String(value), ...(db.lists[list] || [])].slice(0, LIST_CAP);
      save(db);
    },
    async range(list, n) { return (load().lists[list] || []).slice(0, n); },
  };
}

module.exports = REST_URL && REST_TOKEN ? redisStore() : fileStore();
