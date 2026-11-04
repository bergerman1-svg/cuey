// Cuey — AI Builder v3 director (4.11.2026): picks one of Cuey's hand-made motion engines, real footage queries (Pixabay) and the words.
// The engines run in the app (sandboxed) over the footage; nothing here writes code. Signed-in users only; daily limit shared with build-scene.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const FREE_PER_DAY = 3, PRO_PER_DAY = 30, MAX_CHARS = 2000;

const BRIEF = `Cuey is event playback software. Its AI Builder makes ONE breathtaking full-screen slide (1920×1080) for a live event screen — an LED wall or projector in a hall.
The slide is a short motion piece: an INTRO (plays once, 6–12 s) that ends on the hero frame, then a seamless LOOP (6–10 s) that holds that hero frame alive until the operator presses GO.
The audience must say "wow". Think like a top motion-design studio making a title sequence, not like a slideshow.`;

const DIRECT_SYSTEM = `${BRIEF}

You are the DIRECTOR of Cuey's AI Builder. Cuey has hand-made premium motion ENGINES. Each one plays over REAL cinematic footage from a free stock library (Pixabay videos). You pick the engine, the footage and the words — Cuey does the rest. Answer by calling direct ONCE.

ENGINES
- light — the title (and logo) are revealed by light: god rays from above, a light streak, an edge of light sweeping across the letters, dust in the light. Elegant and premium: openings, conferences, corporate evenings, launches, ceremonies, memorials (calm).
- particles — thousands of glowing sparks fly in from depth and assemble the logo / title, then the crisp letters light up. Modern, tech, kick-offs, hi-tech, a logo reveal.
- cinema — a deep 3D extruded title; the camera glides from a low side angle to the hero frame; a light sweep crosses the face. Bold film-title feel: product launches, sports, big announcements, "the next chapter".
- celebrate — fireworks over the footage, a flash, the title pops in with confetti raining through the frame. Parties, New Year, birthdays, end-of-year, weddings, wins.
- award — gold: spotlights sweep, golden rings turn behind a metallic gold title, glitter falls. Awards, honours, galas, VIP, employee of the year.
- holiday — warm bokeh and snow; glowing sparks gather into the title; soft golden light. Christmas, Hanukkah, winter, holidays, family events.

MOOD — pick one; it sets the typeface, how the words are revealed and how much glow there is:
- corporate — clean sans, words rise from a mask, calm easing, little glow. Conferences, company evenings, launches.
- gala — elegant serif, blur-to-focus reveal, gold light, more glow. Awards, honours, galas, weddings.
- tech — letters rise one by one, crisp, cool light. Hi-tech, kick-offs, product, innovation.
- party — bold display face, words slam in with a little bounce. Parties, birthdays, New Year, sports wins.
- memorial — soft serif, letters fade in slowly, no flash, no confetti, no shake. Memorials, remembrance, solemn moments.
Choose a calm engine (light / particles / cinema) for memorial — never celebrate.

FOOTAGE — 2–3 Pixabay VIDEO search queries in ENGLISH, best first. 2–4 words each, concrete and visual, landscape, atmospheric, with no faces as the subject. Good backgrounds are steady or slow (tripod, time-lapse, slow motion), defocused or bokeh, with no clear subject and empty space in the middle; avoid fine patterns and fast camera moves. Words like "bokeh", "abstract", "dark", "timelapse", "slow motion" help. They must fit the mood AND the engine:
  sky/clouds/sunset/aerial for airlines & openings; city night lights / bokeh for tech & corporate; concert crowd lights / fireworks for parties; stage spotlight / gold particles for awards; christmas lights bokeh / snow falling / candles for holidays; ocean waves sunset for calm; memorial candle for memorials.
  Prefer footage that is dark or medium-dark (text sits on top).

WORDS (fields) — in the user's language (Hebrew stays Hebrew). Never invent names, dates or facts the user did not give; leave a field empty ("") rather than invent.
- kicker: small line above (event type / organiser), ≤ 30 chars.
- title: the hero words, SHORT (1–3 words, ≤ 18 chars) — the name, brand or the big message.
- sub: the line below (event name / date / place), ≤ 40 chars.
- accent, accent2: two hex colours from the brand/logo or the mood (accent = main glow).
If a logo is attached, the logo becomes the hero above the title (the title may be the event name).
Less but motivated: the slide makes ONE point. If in doubt, keep the title shorter.
captions: 3 very short lines in the user's language, shown while the slide is built (e.g. "🎬 Real sunset sky footage", "✨ The title is revealed by light").`;

const DIRECT_TOOL = {
  name: "direct",
  description: "Pick the engine, footage and words for the slide.",
  input_schema: {
    type: "object",
    properties: {
      engine: { type: "string", enum: ["light", "particles", "cinema", "celebrate", "award", "holiday"] },
      mood: { type: "string", enum: ["corporate", "gala", "tech", "party", "memorial"] },
      footage: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      title: { type: "string", description: "short name for the slide in the user's language" },
      fields: { type: "array", items: { type: "object", properties: { k: { type: "string", enum: ["kicker", "title", "sub", "accent", "accent2"] }, label: { type: "string", description: "label in the user's language" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
      captions: { type: "array", maxItems: 4, items: { type: "string" } },
    },
    required: ["engine", "mood", "footage", "title", "fields", "captions"],
  },
};

function call(key: string, model: string, system: string, tool: any, content: any[], opts: any) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, stream: true, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }], ...opts }),
  });
}
// read the SSE stream; give up before the 150 s edge limit
async function collect(r: Response, deadline: number) {
  const rd = r.body!.getReader(), dec = new TextDecoder(); let buf = "", tool = "", usage: any = {}, stop = "";
  while (true) {
    if (Date.now() > deadline) { try { await rd.cancel(); } catch { /* */ } stop = "timeout"; break; }
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const dl = ev.split("\n").find((l) => l.startsWith("data:")); if (!dl) continue;
      let d: any; try { d = JSON.parse(dl.slice(5)); } catch { continue; }
      if (d.type === "content_block_delta" && d.delta?.type === "input_json_delta") tool += d.delta.partial_json;
      else if (d.type === "message_start") usage = d.message?.usage || {};
      else if (d.type === "message_delta") { usage = { ...usage, ...(d.usage || {}) }; stop = d.delta?.stop_reason || stop; }
    }
  }
  let input: any = null; try { input = JSON.parse(tool); } catch { /* */ }
  return { input, usage, stop };
}
async function run(key: string, models: string[], system: string, tool: any, content: any[], opts: any, ok: (i: any) => boolean, T0: number) {
  let status = 0, detail = "";
  for (const m of models) {
    const t0 = Date.now(); const r = await call(key, m, system, tool, content, opts); status = r.status;
    if (r.ok) { const c = await collect(r, T0 + 142000); console.log(tool.name, m, Date.now() - t0, "ms", c.stop, JSON.stringify(c.usage)); if (c.input && ok(c.input)) return { out: c.input, model: m, usage: c.usage }; detail = c.stop || "no output"; break; }
    detail = (await r.text()).slice(0, 300); console.error(tool.name, m, r.status, detail);
    if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 429 || (r.status >= 500 && r.status !== 529)) break;
  }
  return { out: null, status, detail };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = env("ANTHROPIC_API_KEY").trim();
  if (!key) return json({ error: "not configured" }, 503);
  const T0 = Date.now();
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: u } = await db.auth.getUser((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
  const user = u?.user; if (!user) return json({ error: "sign in" }, 401);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const prompt = String(body?.prompt || "").trim().slice(0, MAX_CHARS), lang = body?.lang === "he" ? "he" : "en";
  const lg = body?.logo, logo = lg && /^image\/(png|jpeg|webp)$/.test(lg.media_type) && typeof lg.data === "string" && lg.data.length < 3_000_000 ? { media_type: lg.media_type, data: lg.data } : null;
  if (prompt.length < 6) return json({ error: "too short" }, 400);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count }, { data: ents }] = await Promise.all([
    db.from("ai_builds").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("ok", true).eq("cues", -1).gte("created_at", since),
    db.from("entitlements").select("product,expires_at").eq("user_id", user.id),
  ]);
  const pro = (ents || []).some((e: any) => e.product === "pro" && (!e.expires_at || Date.parse(e.expires_at) > Date.now()));
  const cap = pro ? PRO_PER_DAY : FREE_PER_DAY;
  if ((count || 0) >= cap) return json({ error: "limit", cap }, 429);
  const img = logo ? [{ type: "image", source: { type: "base64", media_type: logo.media_type, data: logo.data } }] : [];
  const logoLine = logo ? "Attached: the user's logo / brand picture (it will be the hero of the slide)." : "No logo attached.";
  const r = await run(key, [env("DIRECT_MODEL"), "claude-sonnet-5-5", "claude-opus-5-5"].filter(Boolean), DIRECT_SYSTEM, DIRECT_TOOL, [...img, { type: "text", text: `${logoLine}\nUser's language: ${lang}.\n\nThe request:\n${prompt}\n\nCall direct now.` }],
    { max_tokens: 2500, thinking: { type: "between_tools" }, output_config: { effort: "medium" } }, (i) => typeof i.engine === "string" && Array.isArray(i.fields), T0);
  if (!r.out) { await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length, cues: -1, ok: false }); return json({ error: "ai", status: r.status, detail: r.detail }, 502); }
  const o = r.out, keep = ["kicker", "title", "sub", "accent", "accent2"], seen = new Set();
  o.fields = (o.fields || []).filter((f: any) => keep.includes(f.k) && !seen.has(f.k) && seen.add(f.k)).map((f: any) => ({ k: f.k, label: String(f.label || f.k).slice(0, 40), type: f.k.startsWith("accent") ? "color" : "text", value: String(f.value || "").slice(0, f.k === "sub" ? 60 : 40) }));
  for (const k of keep) if (!seen.has(k)) o.fields.push({ k, label: k, type: k.startsWith("accent") ? "color" : "text", value: k === "accent" ? "#ffcf6b" : k === "accent2" ? "#7cf5ff" : "" });
  console.log("direct", r.model, Date.now() - T0, "ms", o.engine, JSON.stringify(o.footage), JSON.stringify(r.usage));
  await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length + (logo ? 1 : 0), cues: -1, ok: true });
  return json({ direct: o, model: r.model, left: cap - (count || 0) - 1 });
});
