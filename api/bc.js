// BlackClover backend: one Vercel function, data in Upstash Redis (Vercel KV).
// Env: KV_REST_API_URL + KV_REST_API_TOKEN (set by the Vercel Redis integration), ADMIN_PASSWORD (you choose it).
const crypto = require("crypto");

const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN = process.env.ADMIN_PASSWORD || "";

const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };
async function R(...cmd) {
  const res = await fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const pairs = a => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; };
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString("hex");
const fail = (res, code, error) => res.status(code).json({ error });
const authorsMap = A => { const o = {}; for (const [k, v] of Object.entries(pairs(A))) o[k] = J(v) || {}; return o; };

function shape(p, au, st) {
  const a = au[p.author.toLowerCase()];
  return {
    id: p.id, title: p.title, author: p.author, verified: !!(a && a.verified), game: p.game, placeId: p.placeId,
    tags: p.tags, desc: p.desc, hasImg: p.hasImg, at: p.at, status: p.status,
    views: +(st["v:" + p.id] || 0), likes: +(st["l:" + p.id] || 0)
  };
}
const allPosts = async () => Object.values(pairs(await R("HGETALL", "bc:posts"))).map(J).filter(Boolean);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!U || !T) return fail(res, 503, "storage_not_configured");
  const q = req.query || {};
  const a = String(q.a || "");
  let b = req.body;
  if (typeof b === "string") b = J(b);
  b = b || {};
  const post = req.method === "POST";
  const isAdmin = !!ADMIN && same(req.headers["x-admin"] || "", ADMIN);

  try {
    if (a === "img") {
      const d = await R("HGET", "bc:img", clean(q.id, 20));
      if (!d) return fail(res, 404, "not_found");
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.status(200).end(Buffer.from(d, "base64"));
    }

    if (a === "list") {
      const [ps, A, S] = await Promise.all([allPosts(), R("HGETALL", "bc:authors"), R("HGETALL", "bc:stats")]);
      const au = authorsMap(A), st = pairs(S);
      return res.json({ posts: ps.filter(p => p.status === "approved").map(p => shape(p, au, st)) });
    }

    if (a === "get" && post) {
      const id = clean(b.id, 20), cid = clean(b.cid, 64);
      const p = J(await R("HGET", "bc:posts", id));
      if (!p || (p.status !== "approved" && !isAdmin)) return fail(res, 404, "not_found");
      if (cid && (await R("SADD", "bc:v:" + id, cid)) === 1) await R("HINCRBY", "bc:stats", "v:" + id, 1);
      const [A, S, liked] = await Promise.all([R("HGETALL", "bc:authors"), R("HGETALL", "bc:stats"), R("SISMEMBER", "bc:l:" + id, cid || "-")]);
      return res.json({ post: { ...shape(p, authorsMap(A), pairs(S)), code: p.code }, liked: liked === 1 });
    }

    if (a === "like" && post) {
      const id = clean(b.id, 20), cid = clean(b.cid, 64);
      if (!cid) return fail(res, 400, "bad_request");
      const p = J(await R("HGET", "bc:posts", id));
      if (!p || p.status !== "approved") return fail(res, 404, "not_found");
      let liked = true;
      if ((await R("SADD", "bc:l:" + id, cid)) === 1) await R("HINCRBY", "bc:stats", "l:" + id, 1);
      else { await R("SREM", "bc:l:" + id, cid); await R("HINCRBY", "bc:stats", "l:" + id, -1); liked = false; }
      return res.json({ liked, likes: +(await R("HGET", "bc:stats", "l:" + id)) || 0 });
    }

    if (a === "post" && post) {
      const title = clean(b.title, 60), game = clean(b.game, 60), placeId = String(b.placeId || "").trim();
      const name = clean(b.author, 20), pass = String(b.pass || ""), desc = clean(b.desc, 600);
      const code = String(b.code || "").replace(/\r\n/g, "\n");
      const tags = [...new Set(String(b.tags || "").toLowerCase().split(",").map(t => t.trim().replace(/[^a-z0-9 _-]/g, "").slice(0, 16)).filter(Boolean))].slice(0, 5);
      if (title.length < 3) return fail(res, 400, "bad_title");
      if (game.length < 2) return fail(res, 400, "bad_game");
      if (!/^\d{1,15}$/.test(placeId)) return fail(res, 400, "bad_place");
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(name)) return fail(res, 400, "bad_author");
      if (pass.length < 6 || pass.length > 64) return fail(res, 400, "bad_pass");
      if (code.trim().length < 10 || code.length > 20000) return fail(res, 400, "bad_code");
      let img = "";
      if (b.image) {
        const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image));
        if (!m || m[1].length > 260000) return fail(res, 400, "bad_image");
        img = m[1];
      }
      const key = name.toLowerCase();
      let rec = J(await R("HGET", "bc:authors", key));
      if (rec) {
        if (!same(hash(pass, rec.salt), rec.hash)) return fail(res, 403, "wrong_pass");
        if (!rec.verified) {
          const waiting = (await allPosts()).filter(p => p.author.toLowerCase() === key && p.status === "pending").length;
          if (waiting >= 5) return fail(res, 429, "too_many_pending");
        }
      } else {
        const salt = crypto.randomBytes(12).toString("hex");
        rec = { name, salt, hash: hash(pass, salt), verified: false, at: Date.now() };
      }
      const id = crypto.randomBytes(5).toString("hex");
      const status = rec.verified ? "approved" : "pending";
      const p = { id, title, author: rec.name, game, placeId, tags, desc, code, hasImg: !!img, at: Date.now(), status };
      await R("HSET", "bc:authors", key, JSON.stringify(rec));
      await R("HSET", "bc:posts", id, JSON.stringify(p));
      if (img) await R("HSET", "bc:img", id, img);
      return res.json({ ok: true, id, status });
    }

    if (a.startsWith("admin_")) {
      if (!ADMIN) return fail(res, 503, "admin_not_configured");
      if (!isAdmin) return fail(res, 401, "unauthorized");

      if (a === "admin_list") {
        const [ps, A, S] = await Promise.all([allPosts(), R("HGETALL", "bc:authors"), R("HGETALL", "bc:stats")]);
        const au = authorsMap(A), st = pairs(S);
        const posts = ps.sort((x, y) => y.at - x.at).map(p => ({ ...shape(p, au, st), code: p.code }));
        const agg = {};
        for (const [k, v] of Object.entries(au)) agg[k] = { name: v.name || k, verified: !!v.verified, posts: 0, views: 0, likes: 0 };
        for (const p of posts) {
          const g = agg[p.author.toLowerCase()];
          if (g && p.status === "approved") { g.posts++; g.views += p.views; g.likes += p.likes; }
        }
        return res.json({ posts, authors: Object.values(agg) });
      }

      if (a === "admin_set" && post) {
        const id = clean(b.id, 20);
        const p = J(await R("HGET", "bc:posts", id));
        if (!p || !["approved", "rejected"].includes(b.status)) return fail(res, 400, "bad_request");
        p.status = b.status;
        await R("HSET", "bc:posts", id, JSON.stringify(p));
        return res.json({ ok: true });
      }

      if (a === "admin_del" && post) {
        const id = clean(b.id, 20);
        await R("HDEL", "bc:posts", id);
        await R("HDEL", "bc:img", id);
        await R("HDEL", "bc:stats", "v:" + id, "l:" + id);
        await R("DEL", "bc:v:" + id, "bc:l:" + id);
        return res.json({ ok: true });
      }

      if (a === "admin_verify" && post) {
        const key = clean(b.author, 20).toLowerCase();
        const rec = J(await R("HGET", "bc:authors", key));
        if (!rec) return fail(res, 404, "not_found");
        rec.verified = !!b.verified;
        await R("HSET", "bc:authors", key, JSON.stringify(rec));
        return res.json({ ok: true });
      }
    }

    return fail(res, 404, "not_found");
  } catch (e) {
    return fail(res, 500, "server_error");
  }
};
