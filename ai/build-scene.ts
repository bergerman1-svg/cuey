// Cuey — AI Builder (4.11.2026): ONE breathtaking slide from a short prompt (+ optional logo / brand picture).
// Claude writes a small "scene" program (2D canvas or three.js) with editable fields. The app runs it ONLY inside a
// sandboxed iframe (no network, no access to Cuey) and records it into a looping video cue.
// - signed-in users only; the Anthropic key stays here (secret ANTHROPIC_API_KEY)
// - daily limit per user (public.ai_builds, successful builds only; cues = -1 marks a scene build)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("SCENE_MODEL"), "claude-sonnet-5-5", "claude-opus-5-5"].filter(Boolean) as string[];
const FREE_PER_DAY = 3, PRO_PER_DAY = 30, MAX_CHARS = 2000;

const SYSTEM = `You are Cuey's motion designer: you make ONE breathtaking full-screen slide for a live event screen (an LED wall or projector in a hall).
The user writes a short request (sometimes a mini story) and may attach their logo or a picture of their brand. You answer by calling make_scene ONCE.

# What you deliver
A scene = JavaScript code + editable fields. Cuey runs your code in a sandbox and records it into a video that plays intro once, then loops forever until the operator presses GO.

## The code contract (follow exactly)
- Your code is the BODY of an async function with parameters (canvas, F, A, THREE). It must RETURN a function draw(t) (t = seconds from 0).
- canvas is 1920×1080. 2D: const x=canvas.getContext('2d'). 3D: new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true}); R.setSize(1920,1080,false); call R.render(...) at the end of draw.
- THREE is three.js r160 CORE only (no addons: no TextGeometry, no loaders, no postprocessing). For text in 3D draw it on an OffscreenCanvas and use THREE.CanvasTexture on a plane; for glow use additive sprites with radial-gradient textures.
- F = the fields object (strings / #hex colours) — keyed by your fields' k. ALL visible text and main colours must come from F (never hard-code words that appear on screen). Read F inside draw (or rebuild what depends on it at the start of the code).
- A.logo = the user's logo as an ImageBitmap, or null. If they gave one, it is the hero: build the effect around it (particles that form it, light that reveals it…). Keep its colours. If null, use F.title.
- NO network, no DOM, no fetch, no images from URLs, no Math.random (use a seeded PRNG so every render is identical), no Date/performance.now — time comes ONLY from t.
- Deterministic and fast: draw(t) must render any t directly (no state that depends on previous frames). Budget ~15 ms per frame on a laptop: ≤ 12k particles, no per-frame getImageData, cache gradients / offscreen canvases where you can.
- intro (seconds) + loop (seconds): the build-up happens during [0, intro]. After intro, everything must be PERIODIC with period loop so the video loops seamlessly: use ph = 2π(t−intro)/loop and only sin/cos(n·ph) with INTEGER n, or fractions ((t−intro) mod loop)/loop. intro 3–7 s, loop 6–8 s.
- Fonts available: 'Poppins' (300,500,700,900) and 'Heebo' (300,500,800,900, Hebrew). Hebrew text: set ctx.direction='rtl' and use Heebo; don't letter-space Hebrew. Measure text and shrink it to fit (max ~1700px wide).
- Return only plain modern JavaScript (no imports, no TypeScript). Keep the code compact: under ~8,000 characters, no comments, short variable names — it must be generated fast.

## Design standards (this is what makes people say "wow")
- One clear hero moment (the logo/title arriving) + rich atmosphere (light, depth, particles, haze, bloom-like glows), cinematic easing (easeOutCubic / easeInOutCubic), never linear.
- Dark, rich backgrounds that glow on an LED wall; strong contrast; a refined palette of 2–3 colours from the brand or the mood; gold/silver for prestige; vignette.
- Typography: big, confident title; small tracked-out kicker/subtitle; generous spacing; centred. Text must be readable from the back of the hall.
- Respect the content: memorials are calm and dignified (no confetti); parties are energetic; corporate is premium and precise.
- If the user tells a story (e.g. a kid with a balloon, a plane pops it into confetti), stage it in 3–5 beats inside the intro with a stylised illustrated look (silhouettes, flat or low-poly shapes) — never try photoreal people. The ending state (title on screen) is what loops.
- Real brands: use the user's uploaded logo only; never invent or redraw a real company's logo.

## Fields
3–6 fields, each {k, label, type:"text"|"color", value}. Labels in the user's language. Typical: title, subtitle/kicker, small line, 1–2 colours. The values you put are the defaults shown on screen.`;

const TOOL = {
  name: "make_scene",
  description: "Return the one slide: a scene program with editable fields.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short name for this slide, e.g. 'Opening — logo from light'" },
      mode: { type: "string", enum: ["2d", "3d"] },
      intro: { type: "number" }, loop: { type: "number" },
      fields: { type: "array", maxItems: 8, items: { type: "object", properties: { k: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
      code: { type: "string", description: "Body of async function(canvas,F,A,THREE) returning draw(t)" }
    },
    required: ["title", "mode", "intro", "loop", "fields", "code"]
  }
};

async function ask(key: string, model: string, prompt: string, mode: string, lang: string, logo: any) {
  const want = mode === "3d" ? "Make it in 3D (three.js)." : mode === "2d" ? "Make it in 2D (canvas)." : "Choose 2D or 3D — whatever makes this slide most impressive.";
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 12000, stream: true, thinking: { type: "between_tools" }, output_config: { effort: Deno.env.get("SCENE_EFFORT") || "high" }, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], tools: [TOOL], tool_choice: { type: "auto" },
      messages: [{ role: "user", content: [
        ...(logo ? [{ type: "image", source: { type: "base64", media_type: logo.media_type, data: logo.data } }] : []),
        { type: "text", text: (logo ? "Attached: the user's logo / brand picture (it will be passed to your code as A.logo).\n\n" : "No logo was attached (A.logo will be null).\n\n") + `The user's request (UI language: ${lang}):\n\n${prompt}\n\n${want} Call make_scene now.` }] }] }),
  });
}
// read the SSE stream; give up before the 150 s edge limit
async function collect(r: Response, deadline: number) {
  const rd = r.body!.getReader(), dec = new TextDecoder(); const ty: any = {}; let buf = "", tool = "", text = "", usage: any = {}, stop = "", t1 = 0, last = Date.now();
  while (true) {
    if (Date.now() > deadline) { try { await rd.cancel(); } catch {} ; stop = "timeout"; break; }
    const { value, done } = await rd.read(); if (done) break;
    if (!t1) t1 = Date.now();
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const dl = ev.split("\n").find((l) => l.startsWith("data:")); if (!dl) continue;
      let d: any; try { d = JSON.parse(dl.slice(5)); } catch { continue; }
      if (d.type === "content_block_delta") { ty[d.delta?.type] = (ty[d.delta?.type] || 0) + 1; if (d.delta?.type === "input_json_delta") tool += d.delta.partial_json; else if (d.delta?.type === "text_delta") text += d.delta.text; }
      else if (d.type === "message_start") usage = d.message?.usage || {};
      else if (d.type === "message_delta") { usage = { ...usage, ...(d.usage || {}) }; stop = d.delta?.stop_reason || stop; }
    }
    if (Date.now() - last > 15000) { last = Date.now(); console.log("progress", tool.length, "json chars", text.length, "text chars", JSON.stringify(ty)); }
  }
  let input: any = null; try { input = JSON.parse(tool); } catch {}
  console.log("deltas", JSON.stringify(ty), "first byte", t1 ? t1 - (last) : 0); return { input, text, usage, stop, tool: tool.length };
}
const sceneOf = (d: any) => { const u = (d.content || []).find((c: any) => c.type === "tool_use" && c.name === "make_scene"); return u && typeof u.input?.code === "string" && u.input.code.length > 50 ? u.input : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!key) return json({ error: "not configured" }, 503);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await db.auth.getUser((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
  const user = u?.user; if (!user) return json({ error: "sign in" }, 401);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const prompt = String(body?.prompt || "").trim().slice(0, MAX_CHARS), mode = ["2d", "3d"].includes(body?.mode) ? body.mode : "auto", lang = body?.lang === "he" ? "he" : "en";
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

  const T0 = Date.now();
  let scene: any = null, used = "", status = 0, detail = "", usage: any = null;
  for (const m of MODELS) {
    const t0 = Date.now(); const r = await ask(key, m, prompt, mode, lang, logo); used = m; status = r.status; console.log("anthropic", m, r.status, Date.now() - t0, "ms");
    if (r.ok) { const c = await collect(r, T0 + 140000); usage = c.usage; console.log("done", m, Date.now() - t0, "ms", c.stop, c.tool, "json", c.text.length, "text", JSON.stringify(c.usage));
      if (c.input && typeof c.input.code === "string" && c.input.code.length > 50) { scene = c.input; break; } detail = c.stop === "timeout" ? "timeout" : "no scene"; break; }
    detail = (await r.text()).slice(0, 300); console.error("anthropic", m, r.status, detail);
    if (r.status === 400 || r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500) break;
  }
  if (!scene) { await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length, cues: -1, ok: false }); return json({ error: "ai", status, detail }, 502); }
  scene.intro = Math.min(8, Math.max(2, +scene.intro || 4)); scene.loop = Math.min(10, Math.max(4, +scene.loop || 6));
  console.log("scene", used, scene.mode, scene.code.length, "chars", JSON.stringify(usage));
  await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length + (logo ? 1 : 0), cues: -1, ok: true });
  return json({ scene, model: used, left: cap - (count || 0) - 1 });
});
