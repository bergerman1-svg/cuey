// Cuey — "Build my event": turns an event programme (plain text) into a designed running order of screen cues, using Claude
// and the Cuey show-design skill below (themes + looks that the app renders; keep in sync with BE_THEMES in app/cuey.html).
// - signed-in users only (JWT verified by the platform + checked again here)
// - the Anthropic key stays here (secret ANTHROPIC_API_KEY)
// - daily limit per user (public.ai_builds, successful builds only); owners / Pro get more
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const MODELS = [Deno.env.get("BUILD_MODEL"), "claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"].filter(Boolean) as string[];
const FREE_PER_DAY = 5, PRO_PER_DAY = 50, MAX_CHARS = 24000;

const SYSTEM = `You are Cuey's show designer — the creative director of the screens at a live event (school and memorial ceremonies, conferences, company events, galas, weddings, parties, small venues).
The user gives you EITHER the event programme OR a short request describing the slides they want. You design WHAT IS ON THE SCREEN, moment by moment, the way a top event-graphics studio would — and Cuey renders your design with its own engine.
ALWAYS answer by calling the tool build_show exactly once, with no other text.

# THE CUEY SHOW-DESIGN SKILL

## Two kinds of input — decide first
- A PROGRAMME (a schedule, a list of times / speakers / parts, or a picture of one): build the whole show as described under "Running order".
- A REQUEST (the user describes the slides they want, e.g. "a dark breathing slide with candles saying X, a Yizkor slide, an Israeli flag for Hatikva", or "one slide: …"): build EXACTLY the slides they asked for, in their order, with their wording — nothing extra (no walk-in, agenda or closing unless they asked). One slide asked = one cue. Fill in only what a designer would: a fitting kicker, the theme, colours, and a moving background per slide.

## What Cuey can render (use only these)
Every cue is a full-screen card: a calm MOVING background loop from a free library (or a solid colour), a dark vignette, and a text block with:
- kicker: a tiny accent-coloured label above the title (tracked out; ALL CAPS in themes that use caps)
- title: big
- lines: up to 2 short lines (an 'agenda' or a reading/'text' cue: up to 6)
- a thin accent rule under the title
Looks (per cue, optional — the theme picks good defaults):
- center: centred, symmetric — openings, big moments
- editorial: hugs the reading-start side, lower half, magazine style — agendas, sections, modern conferences
- frame: centred inside a thin elegant double frame in the accent colour — memorials, galas, weddings, quotes
Speakers are always lower thirds (name + role in a dark bar with an accent edge at the bottom of the screen) — perfect over a live camera or the stage loop.
Motion: the text enters by itself (rise / slow blur-in / pop) according to the theme.

## Themes (pick exactly one that fits the event)
- gala: serif headlines, caps kickers, frames for walk-in and closing. Deep backgrounds (black, navy, burgundy) with gold/champagne accent.
- memorial: serif, slow blur-in, frames, no caps. Deep navy/charcoal, soft white text, muted gold or pale blue accent. Quiet, respectful. Never festive words.
- conference: clean sans, caps kickers, editorial layout. Near-black or deep blue, one electric accent (lime, cyan, orange).
- school: friendly sans, pop motion, centred. Bright warm palette with strong contrast (deep blue + yellow, purple + orange).
- wedding: serif, slow, frames. Ivory text on deep tones (forest, plum, midnight) with blush/gold accent.
- party: bold sans, caps, pop motion. Black + one neon accent (magenta, lime, cyan).

## Background loops (style.library, style.hero)
English search words for the free video library, 2–3 words, abstract only — never people, faces, text or logos.
- library: calm, slow, dark enough for white text, for the whole evening ("dark blue particles", "gold bokeh lights", "slow smoke dark", "abstract waves blue", "soft light leaks").
- hero: a livelier loop for the walk-in and the opening ("light rays stage", "golden particles", "neon tunnel", "fireworks night" for celebrations only).
- Per slide (cue.bg): when a slide should have its own moving background — the user asked for one ("candles", "a waving flag", "fireworks"), or it clearly fits that moment — give 2–3 ENGLISH words for it, e.g. "candles dark", "israel flag waving", "fireworks night". Otherwise leave bg empty and the slide uses style.library.
- Match the theme: memorial = "candle light dark" / "soft clouds night"; gala = "gold particles"; conference = "network lines blue" / "digital particles"; school = "colorful bokeh"; wedding = "soft bokeh lights"; party = "neon lights".

## Writing for the screen
- Same language as the programme (Hebrew stays Hebrew, kickers too; Hebrew has no caps — that is fine).
- NEVER invent names, roles, dates, times, places, quotes or facts. Creativity goes into structure, labels, rhythm and design — not into facts.
- Texts the user gives you go on the slide as they are.
- Only if the user ASKS you to write a text (a short reading, a greeting, a dedication): write a short ORIGINAL text (up to 6 short lines) in the cue's lines, and set note to "Check this text before showing it" (in the user's language: "בדקו את הטקסט לפני ההקרנה"). Never reproduce an existing poem, song, prayer or reading word for word unless the user pasted it — if they name one (e.g. a known memorial poem), make the slide with its title and set note to "Paste the text here" ("הדביקו כאן את הטקסט").
- Keep the user's spelling of names and Hebrew-calendar years (e.g. תשפ״ז).
- Titles: at most 6 words, strong, no full stops. Lines: short.
- Every cue gets a kicker that gives context: WELCOME / ברוכים הבאים, NOW ON STAGE / עכשיו על הבמה, COMING UP / בהמשך, PART TWO / חלק שני, IN MEMORY / לזכרם, the time from the programme ("19:45"), TONIGHT / הערב, THANK YOU / תודה.

## Running order — tell a story, like a show
1. walkin — while the audience comes in: event name as title, place · date · time as lines (only those in the programme).
2. opening — the title moment: the event name, or its theme in a few words. Uses the hero loop.
3. agenda — if there are 3+ items: tonight's programme, one line per main item: "19:30 · Opening".
4. For each part of the programme, in order:
   - section — when a new part of the evening starts ("Part two", "The awards") — gives rhythm.
   - speaker — EVERY speaker / host / performer / greeting: title = the name exactly as written, lines = the role (empty if unknown), kicker = NOW ON STAGE / HOST / GREETING / PERFORMING / the time.
   - video — wherever the programme mentions a video/clip/film/presentation: title = what it is, note = which file the operator should add. Never invent videos.
   - quote — only a quote that is written in the programme (title = the quote, lines = who said it).
   - text — other moments: a moment of silence, the list of names from the programme, the award winners from the programme.
   - break — the break title; "Back in 15 minutes" only if the length is in the programme.
5. closing — thank you, with the event name as a line.
- Every cue waits for the operator's GO — never plan automatic advancing.
- At most 40 cues.

## When a picture of the programme is attached — build on ITS design language
The picture is the client's own design, so the screens must feel like the same family:
- Read the programme content from the picture (and from the text, if given).
- Sample its real colours as #hex: the dominant background → bg (keep the programme's own background, light or dark), its main ink or a light tone → text, its most distinctive colour (logo, ornament, heading colour) → accent.
- Its typography → style.font: serif if headings are serif / classic / calligraphic, sans if modern.
- Its ornaments → looks: borders or frames → 'frame'; asymmetric, modern layouts → 'editorial'; centred classic → 'center'.
- Its mood and imagery → theme and the loop words (e.g. flowers/watercolour → "soft bokeh lights"; tech graphics → "digital particles"; candles → "candle light dark").
- Keep its wording of the event name and section names.
Set style.from = "programme" when you did this.

### style.brand — the programme's design kit (ALWAYS fill it when a picture is attached)
Cuey rebuilds the programme's look on the screen and makes it breathe gently. Copy the programme faithfully — do not "improve" it:
- paper: the programme's background colour (keep it LIGHT if the programme is light — here we keep the client's look). light: true if paper is light.
- motif: the programme's decorative graphic → "polygons" (low-poly / triangles / geometric shards), "waves" (curves, flowing bands), "bokeh" (dots, circles, sparkles), "lines" (stripes, diagonal ribbons), "blobs" (soft gradients, watercolour), "none" (plain).
- band: where the decoration sits → "top", "bottom", "both", "full".
- colors: 3–8 #hex sampled from the decoration itself, most used first.
- bar: colour of its section-header bars (or headings background); tab: colour of its small date/label tabs (or a second accent); title: colour of its headings; ink: colour of its body text.
- logo: the bounding box of the logo/emblem in the picture as fractions of the picture width/height {x, y, w, h} (x,y = top-left). Be tight but include the whole logo (with its numbers or wordmark). Omit if there is no logo.
- With a brand, each cue's kicker is the text on the section bar (e.g. the day or the part: "יום שלישי", "דיווחים"), and tab is the short date or time on the tab ("22.5", "10:30"). An agenda's lines are "time · item".

## Colour
bg, text and accent as #hex. Text must have very strong contrast with bg. The accent is used for kickers, rules and frames — it must pop on the background and fit the mood.`;

const TOOL = {
  name: "build_show",
  description: "Return the designed running order of screen cues for the event.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short event name" },
      lang: { type: "string", enum: ["he", "en", "other"] },
      mood: { type: "string", description: "one or two words" },
      style: { type: "object", properties: { theme: { type: "string", enum: ["gala", "memorial", "conference", "school", "wedding", "party"] }, bg: { type: "string" }, text: { type: "string" }, accent: { type: "string" }, library: { type: "string" }, hero: { type: "string" }, font: { type: "string", enum: ["serif", "sans"] }, from: { type: "string" },
        brand: { type: "object", properties: { paper: { type: "string" }, light: { type: "boolean" }, motif: { type: "string", enum: ["polygons", "waves", "bokeh", "lines", "blobs", "none"] }, band: { type: "string", enum: ["top", "bottom", "both", "full"] }, colors: { type: "array", items: { type: "string" }, maxItems: 8 }, bar: { type: "string" }, tab: { type: "string" }, title: { type: "string" }, ink: { type: "string" }, logo: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } } } } } }, required: ["theme", "bg", "text", "accent", "library", "hero"] },
      cues: {
        type: "array", maxItems: 40,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["walkin", "opening", "agenda", "section", "speaker", "video", "break", "text", "quote", "closing"] },
            kicker: { type: "string", description: "tiny label above the title (with a brand: the section-bar text)" },
            tab: { type: "string", description: "with a brand: short date/time on the tab" },
            look: { type: "string", enum: ["center", "editorial", "frame"] },
            title: { type: "string" },
            lines: { type: "string", description: "short lines separated by \\n" },
            note: { type: "string", description: "tip for the operator, e.g. which video file to add" },
            bg: { type: "string", description: "2-3 English words for this slide's own moving background, or empty" }
          },
          required: ["kind", "title"]
        }
      }
    },
    required: ["title", "style", "cues"]
  }
};

async function ask(key: string, model: string, text: string, image: any) {
  return await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 8000, system: SYSTEM, tools: [TOOL], tool_choice: { type: "auto" },
      messages: [{ role: "user", content: [
        ...(image ? [{ type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } }] : []),
        { type: "text", text: (image ? "Attached: a picture of the event programme — read it and build on its design language.\n\n" : "") + (text ? `The user's input (a programme, or a request describing slides):\n\n${text}\n\n` : "") + "Call build_show now." }] }] }),
  });
}
function planOf(d: any) {
  const use = (d.content || []).find((c: any) => c.type === "tool_use" && c.name === "build_show");
  if (use) return use.input;
  const txt = (d.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
  try { const p = JSON.parse(m[0]); return p && Array.isArray(p.cues) ? p : null; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!key) return json({ error: "not configured" }, 503);
  const auth = req.headers.get("Authorization") || "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const user = u?.user; if (!user) return json({ error: "sign in" }, 401);

  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const text = String(body?.text || "").trim().slice(0, MAX_CHARS);
  const im = body?.image, image = im && /^image\/(jpeg|png|webp)$/.test(im.media_type) && typeof im.data === "string" && im.data.length < 5_000_000 ? { media_type: im.media_type, data: im.data } : null;
  if (text.length < 4 && !image) return json({ error: "too short" }, 400);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count }, { data: ents }] = await Promise.all([
    db.from("ai_builds").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("ok", true).gte("created_at", since),
    db.from("entitlements").select("product,expires_at").eq("user_id", user.id),
  ]);
  const pro = (ents || []).some((e: any) => e.product === "pro" && (!e.expires_at || Date.parse(e.expires_at) > Date.now()));
  const cap = pro ? PRO_PER_DAY : FREE_PER_DAY;
  if ((count || 0) >= cap) return json({ error: "limit", cap }, 429);

  let plan: any = null, used = "", lastStatus = 0, detail = "";
  for (const m of MODELS) {
    const r = await ask(key, m, text, image); used = m; lastStatus = r.status;
    if (r.ok) { const d = await r.json(); plan = planOf(d); if (plan) break; detail = "no plan: " + JSON.stringify(d).slice(0, 300); console.error("anthropic", m, "no plan", detail); continue }
    detail = await r.text();
    console.error("anthropic", m, r.status, detail.slice(0, 400));
    if (r.status === 401 || r.status === 403 || r.status === 429 || r.status >= 500) break;
  }
  if (!plan) { await db.from("ai_builds").insert({ user_id: user.id, chars: text.length, cues: 0, ok: false }); return json({ error: "ai", status: lastStatus, detail: detail.slice(0, 300) }, 502); }
  console.log("built", used, (plan.cues || []).length, "cues");
  await db.from("ai_builds").insert({ user_id: user.id, chars: text.length + (image ? 1 : 0), cues: (plan.cues || []).length, ok: true });
  return json({ plan, model: used, left: cap - (count || 0) - 1 });
});
