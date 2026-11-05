// Cuey — AI Builder v4 designer-director (4.11.2026): a concept + a LOOK built from Cuey's blocks (compose engine), real footage queries (Pixabay) and the words.
// The engines run in the app (sandboxed) over the footage; nothing here writes code. Signed-in users only; daily limit shared with build-scene.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const FREE_PER_DAY = 3, PRO_PER_DAY = 30, MAX_CHARS = 2000;
const ADMINS = ["46a2d753-7a3f-45fe-83e0-437c16be3642"]; // Avi — testing allowance

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
- reveal: veil (whole line slowly comes into focus — solemn, elegant) | rise (words rise from a mask, slow — premium) | maskWords (words rise, brisk — corporate) | maskChars (letter by letter — tech) | blur (blur-to-focus — gala) | slam (words land with a bounce — party) | pop (words pop with spring — kids/fun) | light (an edge of light wipes the title in — openings) | type (letters appear one by one like a typewriter — a quote, a personal message, a speaker's line) | center (letters rise from the middle outward — symmetric, short powerful titles) | scramble (letters flicker through random letters and lock in reading order — tech, launches, a secret revealed) | glitch (a few short digital glitch bursts — tech, gaming, youth parties ONLY, never formal) | snap (words stretch and snap into place — sports, parties, energy) | count (ONLY when the title is a number the user gave, e.g. "1,250" — it counts up from 0; put what the number means in the kicker, e.g. "משתתפים בכנס").
- energy: 0–1. 0–0.2 = still and quiet (memorial, prayer), 0.3–0.5 = calm confident (conference, ceremony), 0.6–0.8 = festive (gala, launch), 0.9–1 = party. Energy drives glow, bloom, camera motion and flashes.
- light: none | halo (a soft glow behind the words) | rays (god rays from above) | spots (two stage spotlights) | sweep (one light sweep across the title) | ripple (soft rings of light pulse out from behind the title — launches, tech, a heartbeat).
- fx: none | dust | embers (slow rising sparks — candles, memory, warmth) | snow | glitter (falling gold) | bokeh | confetti (bursts when the title lands, then rains) | fireworks | vortex (a slow golden galaxy of sparkles turning behind the title — awards, galas). Combine at most two with "+", e.g. "bokeh+glitter".
- rule: true/false — a thin accent line between title and sub (elegant, ceremonial, editorial).
- fill: white (default) | gold (metallic gold title with a slow shine — awards, galas, VIP, anniversaries) | silver (metallic silver — tech luxury, winter) | accent (title in the accent colour — brand moments).
- ornament: none | stars (a row of small stars under the title — awards, honours).
- tag: true/false — the kicker sits in a solid accent-colour box, like a label (conferences, launches, modern corporate, festivals). Not for memorial or elegant galas.
- grade: natural (default) | duotone (the footage becomes two-tone in the accent colour — bold modern conferences, tech, sport, brand events).
- hold: how the slide lives while waiting for GO — breath (the whole block breathes gently — default) | wave (the letters ripple in a slow wave in reading order — party, kids, fun, music) | none (perfectly still — memorial, formal).
- bg: footage (default — real stock video, picked by looking) | aurora (ribbons of light flowing across a night sky in the accent colours — conferences, launches, airlines, travel, night events) | silk (flowing metallic silk folds — galas, awards, luxury brands) | nebula (deep-space clouds and stars — tech, vision, future, innovation) | liquid (slow liquid gradient in the brand colours — corporate, brand events) | brand (a flat field of the brand's own colour = accent2, like the logo's background; text turns black automatically when that colour is light — use it when the logo sits on a bright solid colour, e.g. orange, yellow, mustard; put the logo's background colour in accent2 and its second colour in accent). Cuey draws these live: pin-sharp on any wall, perfect loop, exactly the brand colours. Prefer them when the brand/feeling matters more than a real place or object, or when the user asks for Cuey's own background; prefer footage when the idea needs something real (a candle, balloons, the sea).
- overlay: 0–0.5 — only with a code bg: real footage (your footage queries, e.g. clouds, bokeh, light) is layered over the drawn background at this strength for depth and realism (0.25–0.35 is usually right; 0 = none).
- prop: none | airplane (a white airliner crossing the sky on the loop — airlines, travel, tourism) | trophy (a slowly turning gold trophy beside the title — awards) | balloons (balloons drifting up — birthdays, kids). One story element at most, only when it tells the brand/occasion story; it never covers the words.
- motif: none | dots | stripes | rings | arc | bars | sparkle (the logo's star/sparkle shape scattered across the slide, gently breathing — use it when the logo has a star, spark or twinkle) — the LEADING graphic element built from the logo's colours and shapes (see Brand language). With no logo it uses your accents.
- panel: none | window | circle | strip — real footage shown INSIDE a framed shape beside the words (rounded window, circle, slanted strip) over a drawn background: great for conferences, brands, travel, people-and-place events. The words go to the reading side, the panel to the other.
- camera: push (slow push-in) | drift | still.
- dark: 0.2–0.7 how much the footage is darkened; blur: 0–4 how defocused the footage is (more blur = text pops).
- Memorial / remembrance: energy ≤ 0.15, no confetti/fireworks/flash/spots, a serif (frankLight / bellefair / david), veil, often rule:true and embers or none.

MOOD — the closest of: corporate | gala | tech | party | memorial.

FOOTAGE — 2–3 Pixabay VIDEO search queries in ENGLISH, best first, 2–4 words each, concrete and visual. Steady or slow (tripod, time-lapse, slow motion), defocused/bokeh or with ONE simple subject off to the side (a candle, a flag, a horizon) and lots of empty dark space; no faces, no fine patterns, no fast moves. Prefer dark or medium-dark. Match the concept, not just the occasion.

DESIGN BIBLE (from Cuey's motion-design research — follow it):
- One idea per slide. The audience reads it in 3 seconds from the back of the hall. Hierarchy: kicker : title : sub ≈ 1 : 4 : 1.3; the title is the largest and brightest thing; nothing else competes.
- Restraint wins ties: at most two effects (one light + one fx), one reveal family, one accent colour plus one support colour. A slide that whispers can be more powerful than one that shouts.
- Match energy to the room: what will people FEEL when this appears? (silence, pride, excitement, warmth, joy). Pick energy, font, reveal and fx from that feeling — not from the occasion's clichés.
- Type: at most two families. Hebrew is never wide-tracked; mark the kicker with colour or weight. Thin luxury faces (assistant, heeboLight, bellefair) only for calm, elegant moments; heavy faces (rubikBlack, karantina, suez, secular) for energy. No hand-drawn faces (amatic) except kids/casual.
- Colour: accents from the brand or the feeling (memory = warm candle gold / ivory; gala = gold / champagne; tech = cyan / electric blue; party = gold + a hot pink or violet; kids = sunny yellow + sky blue; nature = sage / sand). Never pure white backgrounds; text must keep contrast.
- Composition: the footage carries the atmosphere, the words sit in the empty space (layout auto). A single subject (candle, flag, horizon, glass) is better than busy footage. Push-in camera for drama, still for solemnity.
- Light is motivated: rays come from above like a stage or a window; a halo sits behind words; spots for awards and parties. Never a flash in a memorial.
- Brand language: when a logo is attached, think like the brand's designer — take its colours (accent/accent2) and echo its shapes with a motif (dots for dotted/multi-colour marks, stripes for flags/wings/speed, rings for round seals, arc for swooshes, bars for music/data); the motif leads the eye to the title. This almost always lifts the slide.
- Brand colour field: when the logo itself lives on a bright solid colour (its brand IS that colour), the strongest slide is often that same colour full-screen (bg:brand) with black words and a motif — like the brand's own poster. Keep fx/light minimal there (no halo, no bokeh); a motif and a clean reveal carry it.
- Logo: when a logo is attached it is the brand signature, not a billboard — about a quarter to a third of the screen width, above the words; the title stays the biggest WORDS on screen.
- The title is never dead in the hold: Cuey gives it a soft light sweep once per loop (or the letters wave when hold:wave); a slide that only breathes feels unfinished.
- MEDIA LAYER — decide HOW real footage takes part; it is a dial, not a yes/no:
  a) Footage IS the scene (bg:footage, dark 0.4–0.6): when the idea needs a real thing in the room — a candle being lit, the sea, a stadium. The words sit in its empty side.
  b) Footage as a quiet layer UNDER the design (bg: a drawn background + overlay 0.2–0.4): texture and life without stealing focus — clouds under an airline aurora, bokeh under a party gradient, light streaks under tech. ~0.3 is the sweet spot; lower (0.15–0.2) for elegant/calm, higher (0.4) when the footage tells the story.
  c) Footage IN a frame beside the words (panel window/circle/strip): when the place or the people ARE the message — tourism, a city, a campus, a team — and the brand background should stay clean.
  Pick exactly one of a/b/c per slide, and say which in the concept.
- Story element: when the brand or occasion has an obvious object (an airline → an airplane; awards → a trophy; a birthday → balloons) add it as prop — gently moving, never over the words.
- Words: short, human, in the room's voice. The title is what you would want the whole hall to say together. If the user gave a name/brand/event name, it is the hero or the kicker. Never invent facts.

GALLERY — how a great designer thinks (learn the THINKING, never copy these words):
1. "ערב יום הזיכרון לשואה ולגבורה" → concept: silence; one candle being lit in the dark; a single line. look {layout:auto, font:frankLight, reveal:veil, energy:.1, light:none, fx:embers, rule:true, camera:push, dark:.55, blur:1.5}; kicker "ערב יום הזיכרון לשואה ולגבורה", title "לכל איש יש שם", sub "נזכור ולא נשכח"; footage "lighting memorial candle dark", "single candle flame black background".
2. "end of year party for the company" (Hebrew) → concept: the moment everyone raises a glass; gold and warmth, loud but clean. look {layout:center, font:rubikBlack, reveal:slam, energy:.85, light:spots, fx:"bokeh+confetti", rule:false, camera:push}; kicker "מסיבת סוף שנה", title "מרימים כוסית!", sub "".
3. "awards night for our sales team" → concept: the stage before the first name is called; gold light, anticipation. look {layout:center, font:frank, reveal:blur, energy:.65, light:spots, fx:vortex, fill:gold, ornament:stars}; kicker "Sales Awards", title "And the winner is…".
4. "opening of a medical conference" → concept: calm authority, clean and confident, like a keynote. look {layout:auto, font:heebo, reveal:rise, energy:.35, light:halo, fx:dust, rule:false, tag:true, camera:push, blur:3}; footage "abstract blue light bokeh slow".
5. "launch of our new app" → concept: the reveal of something new; letters arrive one by one like code compiling. look {layout:center, font:karantina, reveal:maskChars, energy:.7, light:sweep, fx:dust}; footage "dark blue digital particles", "city night lights bokeh".
6. "wedding welcome screen for Noa and Itay" → concept: two names, soft light, romance without kitsch. look {layout:auto, font:bellefair, reveal:veil, energy:.4, light:halo, fx:bokeh, rule:true}; kicker "ברוכים הבאים", title "נועה & איתי"; footage "warm fairy lights bokeh".
7. "kids birthday, Yali turns 6" → concept: pure joy, a pop of colour. look {layout:center, font:fredoka, reveal:pop, energy:.95, light:none, fx:confetti}; title "יאלי בת 6!"; accents sunny yellow + sky blue; footage "colorful balloons bokeh".
8. "Hanukkah party" → concept: eight small lights growing; warmth. look {layout:auto, font:suez, reveal:rise, energy:.6, light:halo, fx:"embers+bokeh"}; title "חג אורים שמח"; footage "hanukkah candles bokeh dark".
9. "farewell evening for Dalia after 30 years" → concept: gratitude, a smile, a little tear. look {layout:auto, font:frank, reveal:veil, energy:.3, light:halo, fx:dust, rule:true}; kicker "ערב פרידה", title "תודה, דליה"; footage "sunset golden hour slow".
10. "football club season kickoff" → concept: stadium roar, power. look {layout:center, font:karantina, reveal:slam, energy:1, light:spots, fx:fireworks}; footage "stadium lights night".

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
        reveal: { type: "string", enum: ["veil", "rise", "maskWords", "maskChars", "blur", "slam", "pop", "light", "type", "center", "scramble", "glitch", "snap", "count"] },
        energy: { type: "number" }, light: { type: "string", enum: ["none", "halo", "rays", "spots", "sweep", "ripple"] }, fx: { type: "string" }, hold: { type: "string", enum: ["breath", "wave", "none"] },
        rule: { type: "boolean" }, fill: { type: "string", enum: ["white", "gold", "silver", "accent"] }, ornament: { type: "string", enum: ["none", "stars"] }, tag: { type: "boolean" }, grade: { type: "string", enum: ["natural", "duotone"] }, bg: { type: "string", enum: ["footage", "aurora", "silk", "nebula", "liquid", "brand"] }, overlay: { type: "number" }, prop: { type: "string", enum: ["none", "airplane", "trophy", "balloons"] }, motif: { type: "string", enum: ["none", "dots", "stripes", "rings", "arc", "bars", "sparkle"] }, panel: { type: "string", enum: ["none", "window", "circle", "strip"] }, camera: { type: "string", enum: ["push", "drift", "still"] }, dark: { type: "number" }, blur: { type: "number" } },
        required: ["layout", "font", "reveal", "energy", "light", "fx", "rule"] },
      footage: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      title: { type: "string", description: "short name for the slide in the user's language" },
      fields: { type: "array", items: { type: "object", properties: { k: { type: "string", enum: ["kicker", "title", "sub", "accent", "accent2"] }, label: { type: "string", description: "label in the user's language" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
      captions: { type: "array", maxItems: 4, items: { type: "string" } },
    },
    required: ["concept", "mood", "look", "footage", "title", "fields", "captions"],
  },
};

const PICK_TOOL = {
  name: "pick",
  description: "Pick the best background video for the slide.",
  input_schema: { type: "object", properties: {
    index: { type: "integer", description: "number of the chosen candidate (1-based)" },
    why: { type: "string", description: "one short sentence" } }, required: ["index"] },
};
const PICK_SYSTEM = `You are the art director of Cuey's AI Builder. You see still frames of candidate stock videos (numbered) that could play behind a live-event title slide. Pick the ONE that will look best behind the words, by these rules, in order:
1. It fits the concept and the feeling (a memorial is never festive; a party is never gloomy). Reject anything off-topic, odd or cheesy (cartoons, clocks, random objects, stock-photo people posing).
2. It leaves calm, empty space for the words (dark or soft areas); one simple subject off to the side is great; busy, high-contrast, finely patterned or cluttered frames are bad.
3. It looks premium and cinematic: shallow depth of field, bokeh, beautiful light, rich but not garish colour, no watermark-like text, no faces as the subject.
4. Medium-dark is better than bright.
Call pick once.`;

// search Pixabay for candidates and let the model look at them (vision) — returns the chosen hit or null
async function pickFootage(key: string, qs: string[], o: any, T0: number) {
  const pk = env("PIXABAY_KEY"); if (!pk) return null;
  const seen = new Set(), cands: any[] = [];
  for (const q of qs.slice(0, 3)) {
    try {
      const p = new URLSearchParams({ key: pk, q: String(q).toLowerCase().slice(0, 90), safesearch: "true", per_page: "20" });
      const r = await fetch("https://pixabay.com/api/videos/?" + p.toString()); if (!r.ok) continue;
      const d = await r.json(); let k = 0;
      for (const h of (d.hits || [])) {
        const v = h.videos || {}, w = v.medium?.width || 0, ht = v.medium?.height || 0, thumb = v.medium?.thumbnail || v.small?.thumbnail;
        if (!thumb || w < ht || (h.duration && h.duration < 8) || seen.has(h.id)) continue;
        seen.add(h.id); cands.push({ id: h.id, q, thumb, full: w >= 1280 ? v.medium.url : (v.large?.url || v.medium?.url), dur: h.duration, w, h: ht });
        if (++k >= 3) break;
      }
    } catch { /* */ }
  }
  if (cands.length < 2) return cands[0] || null;
  const content: any[] = [];
  cands.forEach((c, i) => { content.push({ type: "text", text: `Candidate ${i + 1} (search "${c.q}", ${c.dur || "?"} s):` }); content.push({ type: "image", source: { type: "url", url: c.thumb } }); });
  const title = (o.fields || []).find((f: any) => f.k === "title")?.value || "";
  content.push({ type: "text", text: `Concept: ${o.concept}\nMood: ${o.mood}. Title on screen: "${title}". Layout: ${o.look?.layout}.\nCall pick now.` });
  const r = await run(key, ["claude-sonnet-5-5", "claude-opus-5-5"], PICK_SYSTEM, PICK_TOOL, content, { max_tokens: 1500, thinking: { type: "between_tools" }, output_config: { effort: "low" } }, (i) => Number.isInteger(i.index), T0);
  const i = r.out ? Math.max(1, Math.min(cands.length, r.out.index)) - 1 : 0;
  console.log("pick", cands.length, "cands ->", i + 1, r.out?.why || "", JSON.stringify(r.usage || {}));
  return { ...cands[i], why: r.out?.why || "", n: cands.length };
}

let LESSONS = "";
function call(key: string, model: string, system: string, tool: any, content: any[], opts: any) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, stream: true, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }, ...(LESSONS && tool.name === "direct" ? [{ type: "text", text: LESSONS }] : [])], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }], ...opts }),
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
  const cap = ADMINS.includes(user.id) ? 300 : pro ? PRO_PER_DAY : FREE_PER_DAY;
  try { const { data: ls } = await db.from("ai_lessons").select("lesson").eq("status", "active").order("id").limit(60); LESSONS = (ls && ls.length) ? "LESSONS LEARNED from reviewed Cuey slides (follow them; they override the gallery when they conflict):\n" + ls.map((l: any, i: number) => `${i + 1}. ${l.lesson}`).join("\n") : ""; } catch { LESSONS = ""; }
  if ((count || 0) >= cap) return json({ error: "limit", cap }, 429);
  const img = logo ? [{ type: "image", source: { type: "base64", media_type: logo.media_type, data: logo.data } }] : [];
  const logoLine = logo ? "Attached: the user's logo / brand picture (it will be the hero of the slide)." : "No logo attached.";
  const r = await run(key, (body?.model === "opus" ? ["claude-opus-5-5", "claude-sonnet-5-5"] : [env("DIRECT_MODEL"), "claude-sonnet-5-5", "claude-opus-5-5"]).filter(Boolean), DIRECT_SYSTEM, DIRECT_TOOL, [...img, { type: "text", text: `${logoLine}\nUser's language: ${lang}.\n\nThe request:\n${prompt}\n\nCall direct now.` }],
    { max_tokens: 4000, thinking: { type: "between_tools" }, output_config: { effort: "medium" } }, (i) => i.look && typeof i.look === "object" && Array.isArray(i.fields), T0);
  if (!r.out) { await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length, cues: -1, ok: false }); return json({ error: "ai", status: r.status, detail: r.detail }, 502); }
  const o = r.out; o.engine = "compose"; const L = o.look, FX = ["dust", "embers", "snow", "glitter", "bokeh", "confetti", "fireworks", "vortex"];
  L.energy = Math.max(0, Math.min(1, +L.energy || 0)); L.fx = String(L.fx || "none").split(/[+, ]+/).filter((f: string) => FX.includes(f)).slice(0, 2).join("+") || "none";
  if (o.mood === "memorial") { L.energy = Math.min(L.energy, .15); L.fx = L.fx.split("+").filter((f: string) => !["confetti", "fireworks", "glitter"].includes(f)).join("+") || "none"; if (L.light === "spots" || L.light === "rays" || L.light === "ripple") L.light = "none"; if (L.hold === "wave") L.hold = "none"; L.tag = false; if (L.grade === "duotone") L.grade = "natural"; if (["glitch", "snap", "scramble", "pop", "slam"].includes(L.reveal)) L.reveal = "veil"; }
  L.dark = Math.max(.15, Math.min(.75, L.dark == null ? .45 : +L.dark)); L.blur = Math.max(0, Math.min(4, L.blur == null ? 1.5 : +L.blur));
  const keep = ["kicker", "title", "sub", "accent", "accent2"], seen = new Set();
  o.fields = (o.fields || []).filter((f: any) => keep.includes(f.k) && !seen.has(f.k) && seen.add(f.k)).map((f: any) => ({ k: f.k, label: String(f.label || f.k).slice(0, 40), type: f.k.startsWith("accent") ? "color" : "text", value: String(f.value || "").slice(0, f.k === "sub" ? 60 : 44) }));
  for (const k of keep) if (!seen.has(k)) o.fields.push({ k, label: k, type: k.startsWith("accent") ? "color" : "text", value: k === "accent" ? "#ffcf6b" : k === "accent2" ? "#7cf5ff" : "" });
  console.log("direct", r.model, Date.now() - T0, "ms", o.concept, JSON.stringify(o.look), JSON.stringify(o.footage), JSON.stringify(r.usage));
  L.overlay = Math.max(0, Math.min(.5, +L.overlay || 0));
  if (body?.pick !== false && (!L.bg || L.bg === "footage" || L.overlay > 0 || (L.panel && L.panel !== "none"))) { try { o.pick = await pickFootage(key, (o.footage || []).map(String), o, T0); } catch (e) { console.error("pick", String(e)); } }
  await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length + (logo ? 1 : 0), cues: -1, ok: true });
  return json({ direct: o, model: r.model, left: cap - (count || 0) - 1 });
});
