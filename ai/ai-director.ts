// Cuey — AI Builder v4 designer-director (4.11.2026): a concept + a LOOK built from Cuey's blocks (compose engine), real footage queries (Pixabay) and the words.
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

You are the DESIGNER-DIRECTOR of Cuey's AI Builder. You design the slide like a senior motion designer, then Cuey's engine builds it exactly from your LOOK over REAL footage from a free stock library (Pixabay videos). Answer by calling direct ONCE.

THINK FIRST (in "concept", one or two sentences): what is the ONE feeling of this moment in the hall? What is the single idea (a line, an image, a gesture)? What do you leave OUT? Restraint is design: a memorial whispers, a party shouts, a gala glows, a conference is confident and clean.

WORDS (fields) — in the user's language (Hebrew stays Hebrew).
- title: the hero line, SHORT (1–4 words, ≤ 22 chars). When the user only names the occasion, you may write a meaningful line that a real designer would put on the screen for it — a well-known motto, blessing or phrase of that occasion (e.g. Holocaust Remembrance Day → "לכל איש יש שם"; Rosh Hashana → "שנה טובה ומתוקה"; New Year → "Here's to 2027"), and move the occasion's name to the kicker.
- kicker: the small line above — usually the event / occasion / organiser name, ≤ 36 chars.
- sub: a quiet line below (a short echo of the idea, the date or place ONLY if given), ≤ 44 chars; may be "".
- Never invent names, dates, places, numbers or facts the user did not give.
- accent, accent2: two hex colours (accent = the kicker, the thin rule and any glow; from the brand/logo or the mood).

LOOK — the design, built from Cuey's blocks:
- layout: auto (Cuey reads the footage and puts the words in the empty side — best default) | center | right | left | top | bottom.
- font: heebo (clean bold sans) | heeboLight (thin modern sans) | assistant (ultra-thin minimal luxury) | rubik / rubikBlack (round, strong, friendly) | karantina (tall condensed display, huge poster impact — sports, tech, big statements) | suez (heavy classic serif display — festive, holidays) | secular (bold friendly display — parties) | frank (classic serif bold — galas, heritage) | frankLight (classic serif — ceremonies, remembrance) | bellefair (refined thin serif — luxury, gala, weddings) | notoSerif (light literary serif) | david (traditional book serif — heritage, Jewish holidays) | amatic (hand-drawn — kids, casual fun) | fredoka (rounded playful — kids, birthdays).
- reveal: veil (whole line slowly comes into focus — solemn, elegant) | rise (words rise from a mask, slow — premium) | maskWords (words rise, brisk — corporate) | maskChars (letter by letter — tech) | blur (blur-to-focus — gala) | slam (words land with a bounce — party) | pop (words pop with spring — kids/fun) | light (an edge of light wipes the title in — openings).
- energy: 0–1. 0–0.2 = still and quiet (memorial, prayer), 0.3–0.5 = calm confident (conference, ceremony), 0.6–0.8 = festive (gala, launch), 0.9–1 = party. Energy drives glow, bloom, camera motion and flashes.
- light: none | halo (a soft glow behind the words) | rays (god rays from above) | spots (two stage spotlights) | sweep (one light sweep across the title).
- fx: none | dust | embers (slow rising sparks — candles, memory, warmth) | snow | glitter (falling gold) | bokeh | confetti (bursts when the title lands, then rains) | fireworks. Combine at most two with "+", e.g. "bokeh+glitter".
- rule: true/false — a thin accent line between title and sub (elegant, ceremonial, editorial).
- camera: push (slow push-in) | drift | still.
- dark: 0.2–0.7 how much the footage is darkened; blur: 0–4 how defocused the footage is (more blur = text pops).
- Memorial / remembrance: energy ≤ 0.15, no confetti/fireworks/flash/spots, a serif (frankLight / bellefair / david), veil, often rule:true and embers or none.

MOOD — the closest of: corporate | gala | tech | party | memorial.

FOOTAGE — 2–3 Pixabay VIDEO search queries in ENGLISH, best first, 2–4 words each, concrete and visual. Steady or slow (tripod, time-lapse, slow motion), defocused/bokeh or with ONE simple subject off to the side (a candle, a flag, a horizon) and lots of empty dark space; no faces, no fine patterns, no fast moves. Prefer dark or medium-dark. Match the concept, not just the occasion.

captions: 3 very short lines in the user's language, shown while the slide is built, that tell the user your idea (e.g. "🕯️ נר אחד בחושך", "✍️ 'לכל איש יש שם' נחשף לאט").`;

const DIRECT_TOOL = {
  name: "direct",
  description: "Design the slide: concept, look, footage and words.",
  input_schema: {
    type: "object",
    properties: {
      concept: { type: "string", description: "1–2 sentences: the feeling, the single idea, what you leave out" },
      mood: { type: "string", enum: ["corporate", "gala", "tech", "party", "memorial"] },
      look: { type: "object", properties: {
        layout: { type: "string", enum: ["auto", "center", "right", "left", "top", "bottom"] },
        font: { type: "string", enum: ["heebo", "heeboLight", "assistant", "rubik", "rubikBlack", "karantina", "suez", "secular", "frank", "frankLight", "bellefair", "notoSerif", "david", "amatic", "fredoka"] },
        reveal: { type: "string", enum: ["veil", "rise", "maskWords", "maskChars", "blur", "slam", "pop", "light"] },
        energy: { type: "number" }, light: { type: "string", enum: ["none", "halo", "rays", "spots", "sweep"] }, fx: { type: "string" },
        rule: { type: "boolean" }, camera: { type: "string", enum: ["push", "drift", "still"] }, dark: { type: "number" }, blur: { type: "number" } },
        required: ["layout", "font", "reveal", "energy", "light", "fx", "rule"] },
      footage: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      title: { type: "string", description: "short name for the slide in the user's language" },
      fields: { type: "array", items: { type: "object", properties: { k: { type: "string", enum: ["kicker", "title", "sub", "accent", "accent2"] }, label: { type: "string", description: "label in the user's language" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
      captions: { type: "array", maxItems: 4, items: { type: "string" } },
    },
    required: ["concept", "mood", "look", "footage", "title", "fields", "captions"],
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
  const r = await run(key, (body?.model === "opus" ? ["claude-opus-5-5", "claude-sonnet-5-5"] : [env("DIRECT_MODEL"), "claude-sonnet-5-5", "claude-opus-5-5"]).filter(Boolean), DIRECT_SYSTEM, DIRECT_TOOL, [...img, { type: "text", text: `${logoLine}\nUser's language: ${lang}.\n\nThe request:\n${prompt}\n\nCall direct now.` }],
    { max_tokens: 4000, thinking: { type: "between_tools" }, output_config: { effort: "medium" } }, (i) => i.look && typeof i.look === "object" && Array.isArray(i.fields), T0);
  if (!r.out) { await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length, cues: -1, ok: false }); return json({ error: "ai", status: r.status, detail: r.detail }, 502); }
  const o = r.out; o.engine = "compose"; const L = o.look, FX = ["dust", "embers", "snow", "glitter", "bokeh", "confetti", "fireworks"];
  L.energy = Math.max(0, Math.min(1, +L.energy || 0)); L.fx = String(L.fx || "none").split(/[+, ]+/).filter((f: string) => FX.includes(f)).slice(0, 2).join("+") || "none";
  if (o.mood === "memorial") { L.energy = Math.min(L.energy, .15); L.fx = L.fx.split("+").filter((f: string) => !["confetti", "fireworks", "glitter"].includes(f)).join("+") || "none"; if (L.light === "spots" || L.light === "rays") L.light = "none"; }
  L.dark = Math.max(.15, Math.min(.75, L.dark == null ? .45 : +L.dark)); L.blur = Math.max(0, Math.min(4, L.blur == null ? 1.5 : +L.blur));
  const keep = ["kicker", "title", "sub", "accent", "accent2"], seen = new Set();
  o.fields = (o.fields || []).filter((f: any) => keep.includes(f.k) && !seen.has(f.k) && seen.add(f.k)).map((f: any) => ({ k: f.k, label: String(f.label || f.k).slice(0, 40), type: f.k.startsWith("accent") ? "color" : "text", value: String(f.value || "").slice(0, f.k === "sub" ? 60 : 44) }));
  for (const k of keep) if (!seen.has(k)) o.fields.push({ k, label: k, type: k.startsWith("accent") ? "color" : "text", value: k === "accent" ? "#ffcf6b" : k === "accent2" ? "#7cf5ff" : "" });
  console.log("direct", r.model, Date.now() - T0, "ms", o.concept, JSON.stringify(o.look), JSON.stringify(o.footage), JSON.stringify(r.usage));
  await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length + (logo ? 1 : 0), cues: -1, ok: true });
  return json({ direct: o, model: r.model, left: cap - (count || 0) - 1 });
});
