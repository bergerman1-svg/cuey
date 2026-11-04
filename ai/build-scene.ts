// Cuey — AI Builder (4.11.2026): ONE breathtaking slide from a short prompt (+ optional logo / brand picture).
// Two steps, two calls (each well under the 150 s edge limit):
//   step "plan"  — the director (Claude) writes a treatment: concept, look, 3–6 shots with camera moves, the hero moment, the loop.
//   step "build" — the motion designer (Claude) turns that treatment into a scene program (2D canvas or three.js + the Cuey kit K).
// The app runs the program ONLY inside a sandboxed iframe (no network, no access to Cuey) and records it into a looping video cue.
// - signed-in users only; the Anthropic key stays here (secret ANTHROPIC_API_KEY)
// - daily limit per user (public.ai_builds, successful builds only; cues = -1 marks a scene build)
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const PLAN_MODELS = [env("PLAN_MODEL"), "claude-opus-5-5", "claude-sonnet-5-5"].filter(Boolean);
const BUILD_MODELS = [env("SCENE_MODEL"), "claude-sonnet-5-5", "claude-opus-5-5"].filter(Boolean);
const FREE_PER_DAY = 3, PRO_PER_DAY = 30, MAX_CHARS = 2000;

const BRIEF = `Cuey is event playback software. Its AI Builder makes ONE breathtaking full-screen slide (1920×1080) for a live event screen — an LED wall or projector in a hall.
The slide is a short motion piece: an INTRO (plays once, 6–12 s) that ends on the hero frame, then a seamless LOOP (6–10 s) that holds that hero frame alive until the operator presses GO.
The audience must say "wow". Think like a top motion-design studio making a title sequence, not like a slideshow.`;

const PLAN_SYSTEM = `${BRIEF}

You are the DIRECTOR. Read the request (and look at the attached logo/brand picture if any) and write a short, concrete treatment by calling make_plan once.
- Find ONE strong creative idea that fits the occasion and brand (a visual metaphor, a reveal, a journey). If the user told a story, keep their beats but make them cinematic.
- Prefer 3D (three.js) whenever there is a story, objects, depth or camera travel; 2D only for typographic / flat-graphic pieces.
- Shots: 3–6 shots inside the intro with real camera language — establishing wide, slow push-in, low-angle hero, tracking alongside a moving object, crane up, orbit, whip-pan or match-cut transitions, a final hero framing. Every shot says WHAT is on screen, WHAT moves, and the CAMERA move, with start/end times.
- Make it alive: anticipation and overshoot, secondary motion (strings sway, light flicker, dust), parallax depth layers, a lighting change at the hero moment (flash, sunrise, spotlight), particles that react.
- Look: a refined palette of 2–4 colours (brand colours if a logo is given), lighting mood, atmosphere (haze, stars, clouds, bokeh), materials.
- The loop: what keeps moving after the intro (slow camera drift / orbit, breathing light, particles), seamless.
- Respect the content: memorials calm and dignified; parties energetic; corporate premium.
- Never photoreal people: stylised low-poly figures or silhouettes. Real brands: only the user's uploaded logo; never redraw a real company's logo.
- The builder has stylised props ready (person/kid with poses, balloon, airliner, soft clouds, gift, trophy, confetti, stars, glow, 3D text, the user's logo); anything else is built from primitives — keep objects simple and let light, camera and motion do the magic.
- Fields: the on-screen texts and main colours the operator may edit (labels in the user's language).
Write the treatment in English (the builder reads it), concise and specific — numbers, not adjectives.`;

const PLAN_TOOL = {
  name: "make_plan",
  description: "The director's treatment for the one slide.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short name for the slide (user's language)" },
      concept: { type: "string", description: "The idea in 1–2 sentences" },
      mode: { type: "string", enum: ["2d", "3d"] },
      intro: { type: "number", description: "seconds, 6–12" }, loop: { type: "number", description: "seconds, 6–10" },
      look: { type: "string", description: "palette (hex), lighting, atmosphere, materials, typography" },
      shots: { type: "array", minItems: 2, maxItems: 7, items: { type: "object", properties: { from: { type: "number" }, to: { type: "number" }, shot: { type: "string", description: "what is on screen + what moves" }, camera: { type: "string", description: "camera position/move/lens" } }, required: ["from", "to", "shot", "camera"] } },
      hero: { type: "string", description: "the final hero frame (title/logo layout)" },
      loopIdea: { type: "string", description: "what moves during the seamless loop" },
      captions: { type: "array", maxItems: 6, items: { type: "string" }, description: "3–6 very short lines in the USER'S language describing the shots, shown while the slide is built (e.g. '🎬 Wide: a kid on a hill at sunset')" },
      fields: { type: "array", maxItems: 8, items: { type: "object", properties: { k: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
    },
    required: ["title", "concept", "mode", "intro", "loop", "look", "shots", "hero", "loopIdea", "captions", "fields"],
  },
};

const KIT_DOC = `## The Cuey kit K (use it — it makes things look good and keeps your code short)
Timing / easing: K.k(t,a,b) ramp 0→1 between a and b · K.lerp(a,b,u) · K.e.o3 / o5 / i3 / io3 / sine / back / elastic (u→u, clamped) · K.rng(seed) seeded PRNG · K.lp(t,intro,loop) → {u (0..1 in the loop, 0 during intro), ph (=2πu), on}
K.track([{t,v,e?},...]) → f(t) eased keyframes for numbers or arrays.
2D: K.cam2d(ctx,{x,y,z,r}) sets a world camera ((0,0)=screen centre, z=zoom, r=roll) · K.text2d(ctx,str,{font:'900 # Poppins',px,maxW,color,glow,blur,ls,dir,at:[x,y],alpha}) auto-shrinks to maxW ('#' = size) · K.fit(ctx,str,font,maxW,px,ls) · K.glow2d(ctx,x,y,r,color,a) · K.vignette(ctx,a)
3D (three.js r160 + bloom; 1 unit ≈ 1 m; y up). SCALE: keep the set within ~80 m; people 1.2–1.8 m, balloon ~1 m, airliner ~10 m; put the camera 4–40 m from what it frames; nothing big may sit between the camera and the hero:
- const st=K.stage(canvas,{bg,fog:[color,near,far],fov,bloom:{s,r,th}|null,exposure}) → {R,S:scene,C:camera,bloom,render()}. ACES tone mapping, soft shadows, UnrealBloom. Call st.render() at the end of draw. st.bloom.strength can animate.
- K.lights(S,{sky,ground,amb,key,keyI,keyPos:[x,y,z],rim,rimI}) → {hemi,key,rim} (key casts shadows)
- const cam=K.camera(C,[{t,p:[x,y,z],look:[x,y,z],fov?,e?},...]) → cam(t,shake) eased camera moves between keys. THIS is how you do shots. Add your own drift in the loop after calling it.
- K.text(str,{font:'900 # Poppins',color,h (world height),glow,ls,dir:'rtl'(Hebrew→use Heebo),emissive}) → Group (.material.opacity, .setText(s), .width). Move/scale the group freely.
- K.logo(A.logo,{h}) → Mesh of the user's logo · K.glow(color,size,opacity) additive glow sprite · K.stars(n,{r,size,color,y:[min,max]}) Points
- K.confetti(n,{colors,size,gravity}) InstancedMesh; call c.burst(ageSeconds, [x,y,z], power) every frame (age<0 hides it)
- Props (stylised low-poly, stand on y=0, return Groups): K.person({body,skin,legs,hair,h,kid}) with .pose({armL,armR,walk,head}) and .hand (Object3D in the right hand: p.updateMatrixWorld(true); p.hand.getWorldPosition(v)) · K.balloon({color}) (.bulb .string; its ORIGIN is the bottom of the string — put the origin exactly at the hand, the bulb floats 1.3–2 m above) · K.airplane({body,accent,tail,text}) nose +x, ~10 m · K.cloud({seed,s,color,shade,opacity}) soft billboard cloud ~8·s m wide (s 0.5–4; place clouds BEHIND/BELOW the action, never in front of the title) (.opacity(v)) · K.gift({box,ribbon,s}) · K.trophy({color,s}) · K.ground({color,size})
- Plus everything in THREE (MeshPhysicalMaterial, InstancedMesh, ShaderMaterial for skies/gradients, CatmullRomCurve3, RoundedBoxGeometry, …). Build anything else from primitives.`;

const REF = `const st=K.stage(canvas,{bg:'#0b0f2a',fog:['#c46a6a',60,220],fov:38,bloom:{s:.9,r:.6,th:.7}}),{S,C}=st,E=K.e,IN=9,LP=8;
const sky=new THREE.Mesh(new THREE.SphereGeometry(600,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{a:{value:new THREE.Color('#070a24')},b:{value:new THREE.Color('#ff7a59')}},
 vertexShader:'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 a,b;varying vec3 p;void main(){float h=smoothstep(-.05,.45,p.y);gl_FragColor=vec4(mix(b,a,h),1.);}'}));S.add(sky);
K.lights(S,{key:'#ffd2b0',keyI:2.4,rim:'#ff8a5c',rimI:3,keyPos:[-10,8,6]});
const kid=K.person({kid:true,body:F.c1,h:1.15});kid.rotation.y=.5;S.add(kid);const bal=K.balloon({color:F.c1});S.add(bal);
const plane=K.airplane({accent:F.c1,text:F.brand});S.add(plane);const conf=K.confetti(700,{colors:[F.c1,F.c2,'#ffffff','#7cf5ff']});S.add(conf);
const title=K.text(F.title,{glow:F.c1,h:5,ls:30,emissive:.8}),sub=K.text(F.sub,{font:'500 # Poppins',color:F.c2,h:1.1,ls:24,emissive:1.2});S.add(title,sub);
const cam=K.camera(C,[{t:0,p:[3,1.1,5],look:[0,1,0],fov:34},{t:2,p:[2.2,1.3,4],look:[0,1.6,0]},{t:3.2,p:[1.5,.8,6],look:[1,6,-2],fov:42},{t:5,p:[-2,6,14],look:[3,13,-6],fov:46},{t:8.5,p:[0,12,19],look:[0,15,-6],fov:40,e:'o3'}]);
const H=new THREE.Vector3(),POP=[4,14.5,-6],BURST=5.6;
return function draw(t){const L=K.lp(t,IN,LP);cam(t,t>BURST&&t<BURST+.5?.06:0);if(L.on){C.position.x+=Math.sin(L.ph)*.6;C.lookAt(0,15,-6)}
 const rise=E.io3(K.k(t,1.6,5.4));kid.pose({armR:2.9-K.k(t,1.6,2.6),head:-rise*.6});kid.updateMatrixWorld(true);kid.hand.getWorldPosition(H);
 bal.visible=t<BURST;bal.position.set(H.x+rise*POP[0],H.y-1.25+rise*(POP[1]-H.y+1.25)+Math.sin(t*2.3)*.08,H.z+rise*POP[2]);
 const pf=K.k(t,4.3,7.4);plane.visible=pf>0&&pf<1;plane.position.set(K.lerp(-40,46,E.sine(pf)),14.5,-6.5);
 conf.burst(t-BURST,POP,1.2);const ti=E.back(K.k(t,6.6,7.9));title.position.set(0,16-(1-ti)*1.5,-6);title.material.opacity=K.k(t,6.6,7.3);title.scale.setScalar(.85+.15*ti);
 sub.position.set(0,12.2,-6);sub.material.opacity=E.o3(K.k(t,7.4,8.6));st.bloom.strength=.9+.25*Math.sin(L.ph);st.render()}`;

const BUILD_SYSTEM = `${BRIEF}

You are the MOTION DESIGNER / creative coder. You get the user's request and the director's treatment. Build it faithfully — every shot, camera move and timing — and make it look premium. Answer by calling make_scene ONCE.

## The code contract (follow exactly)
- Your code is the BODY of an async function with parameters (canvas, F, A, THREE, K). It must RETURN a function draw(t) (t = seconds from 0). canvas is 1920×1080.
- 2D: const x=canvas.getContext('2d'). 3D: use K.stage(canvas,…) (it makes the WebGL renderer, scene, camera and bloom).
- F = the fields object, keyed by the treatment's field keys. ALL visible text and main colours come from F (never hard-code on-screen words).
- A.logo = the user's logo as an ImageBitmap, or null. If given, it is the hero (K.logo for 3D, drawImage for 2D). Keep its colours.
- NO network, no DOM, no fetch, no Math.random (use K.rng), no Date/performance.now — time comes ONLY from t. draw(t) must render ANY t directly (no state carried between frames), so the video can be recorded frame by frame.
- Budget ~20 ms per frame: ≤ 20k particles/instances, no per-frame canvas-texture rebuilds, reuse geometries/materials.
- Loop: after intro, everything must be PERIODIC with period loop (use K.lp: sin/cos(n·ph) with whole n, or u). The last intro frame must equal the loop's start (hold the hero frame, then drift).
- Fonts: 'Poppins' (300,500,700,900) and 'Heebo' (300,500,800,900, Hebrew). Hebrew: dir 'rtl' + Heebo, no letter-spacing.
- Plain modern JavaScript, no comments, short names, under ~12,000 characters. The hero title must be big (≥ 40% of the frame width) and readable from the back of a hall; keep text out of heavy bloom (emissive ≤ 0.9 on bright text).

${KIT_DOC}

## A small reference (3D story with camera moves) — the level of craft expected is HIGHER than this
${REF}`;

const REVIEW = `

## REVIEW PASS
You now see real frames rendered from your scene. Be a strict director. Check every frame:
- Is the subject of each shot actually in frame, readable and well composed (not tiny, not cut off, not hidden behind clouds/particles/glow)?
- Does the story read beat by beat? Is the camera move visible and purposeful?
- Hero frame: is the title/logo big (≥ 40% width), sharp, clearly readable, not blown out by bloom, not covered?
- Is anything covering the whole screen (giant sprites, fog, a flat wall of colour)? Blank or near-empty frames?
- Colour, contrast and depth: rich darks, glowing highlights, layers of depth?
- Does the loop part look alive and continuous?
First write 3–8 short bullet observations (what is wrong / weak), then call make_scene with the FULL corrected code (same fields keys unless broken). Fix the problems for real — move the camera, rescale, reposition, re-time — don't just tweak numbers blindly. If it failed to run, fix the error.`;

const DIRECT_SYSTEM = `${BRIEF}

You are the DIRECTOR of Cuey's AI Builder. Cuey has hand-made premium motion ENGINES. Each one plays over REAL cinematic footage from a free stock library (Pixabay videos). You pick the engine, the footage and the words — Cuey does the rest. Answer by calling direct ONCE.

ENGINES
- light — the title (and logo) are revealed by light: god rays from above, a light streak, an edge of light sweeping across the letters, dust in the light. Elegant and premium: openings, conferences, corporate evenings, launches, ceremonies, memorials (calm).
- particles — thousands of glowing sparks fly in from depth and assemble the logo / title, then the crisp letters light up. Modern, tech, kick-offs, hi-tech, a logo reveal.
- cinema — a deep 3D extruded title; the camera glides from a low side angle to the hero frame; a light sweep crosses the face. Bold film-title feel: product launches, sports, big announcements, "the next chapter".
- celebrate — fireworks over the footage, a flash, the title pops in with confetti raining through the frame. Parties, New Year, birthdays, end-of-year, weddings, wins.
- award — gold: spotlights sweep, golden rings turn behind a metallic gold title, glitter falls. Awards, honours, galas, VIP, employee of the year.
- holiday — warm bokeh and snow; glowing sparks gather into the title; soft golden light. Christmas, Hanukkah, winter, holidays, family events.

FOOTAGE — 2–3 Pixabay VIDEO search queries in ENGLISH, best first. 2–4 words each, concrete and visual, landscape, atmospheric, with no faces as the subject. They must fit the mood AND the engine:
  sky/clouds/sunset/aerial for airlines & openings; city night lights / bokeh for tech & corporate; concert crowd lights / fireworks for parties; stage spotlight / gold particles for awards; christmas lights bokeh / snow falling / candles for holidays; ocean waves sunset for calm; memorial candle for memorials.
  Prefer footage that is dark or medium-dark (text sits on top).

WORDS (fields) — in the user's language (Hebrew stays Hebrew). Never invent names, dates or facts the user did not give; leave a field empty ("") rather than invent.
- kicker: small line above (event type / organiser), ≤ 30 chars.
- title: the hero words, SHORT (1–3 words, ≤ 18 chars) — the name, brand or the big message.
- sub: the line below (event name / date / place), ≤ 40 chars.
- accent, accent2: two hex colours from the brand/logo or the mood (accent = main glow).
If a logo is attached, the logo becomes the hero above the title (the title may be the event name).
captions: 3 very short lines in the user's language, shown while the slide is built (e.g. "🎬 Real sunset sky footage", "✨ The title is revealed by light").`;

const DIRECT_TOOL = {
  name: "direct",
  description: "Pick the engine, footage and words for the slide.",
  input_schema: {
    type: "object",
    properties: {
      engine: { type: "string", enum: ["light", "particles", "cinema", "celebrate", "award", "holiday"] },
      footage: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
      title: { type: "string", description: "short name for the slide in the user's language" },
      fields: { type: "array", items: { type: "object", properties: { k: { type: "string", enum: ["kicker", "title", "sub", "accent", "accent2"] }, label: { type: "string", description: "label in the user's language" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
      captions: { type: "array", maxItems: 4, items: { type: "string" } },
    },
    required: ["engine", "footage", "title", "fields", "captions"],
  },
};

const TOOL = {
  name: "make_scene",
  description: "Return the one slide: a scene program with editable fields.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" }, mode: { type: "string", enum: ["2d", "3d"] },
      intro: { type: "number" }, loop: { type: "number" },
      fields: { type: "array", maxItems: 8, items: { type: "object", properties: { k: { type: "string" }, label: { type: "string" }, type: { type: "string", enum: ["text", "color"] }, value: { type: "string" } }, required: ["k", "label", "type", "value"] } },
      code: { type: "string", description: "Body of async function(canvas,F,A,THREE,K) returning draw(t)" },
    },
    required: ["title", "mode", "intro", "loop", "fields", "code"],
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
  const prompt = String(body?.prompt || "").trim().slice(0, MAX_CHARS), mode = ["2d", "3d"].includes(body?.mode) ? body.mode : "auto", lang = body?.lang === "he" ? "he" : "en";
  const lg = body?.logo, logo = lg && /^image\/(png|jpeg|webp)$/.test(lg.media_type) && typeof lg.data === "string" && lg.data.length < 3_000_000 ? { media_type: lg.media_type, data: lg.data } : null;
  if (prompt.length < 6) return json({ error: "too short" }, 400);
  const step = ["build", "review", "direct"].includes(body?.step) ? body.step : "plan";

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count }, { data: ents }] = await Promise.all([
    db.from("ai_builds").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("ok", true).eq("cues", -1).gte("created_at", since),
    db.from("entitlements").select("product,expires_at").eq("user_id", user.id),
  ]);
  const pro = (ents || []).some((e: any) => e.product === "pro" && (!e.expires_at || Date.parse(e.expires_at) > Date.now()));
  const cap = pro ? PRO_PER_DAY : FREE_PER_DAY;
  if ((count || 0) >= cap) return json({ error: "limit", cap }, 429);

  const img = logo ? [{ type: "image", source: { type: "base64", media_type: logo.media_type, data: logo.data } }] : [];
  const logoLine = logo ? "Attached: the user's logo / brand picture (passed to the code as A.logo)." : "No logo attached (A.logo is null).";
  const want = mode === "3d" ? "The user chose 3D." : mode === "2d" ? "The user chose 2D." : "";

  if (step === "direct") {
    const r = await run(key, [env("DIRECT_MODEL"), "claude-sonnet-5-5", "claude-opus-5-5"].filter(Boolean), DIRECT_SYSTEM, DIRECT_TOOL, [...img, { type: "text", text: `${logoLine}\nUser's language: ${lang}.\n\nThe request:\n${prompt}\n\nCall direct now.` }],
      { max_tokens: 2500, thinking: { type: "between_tools" }, output_config: { effort: "medium" } }, (i) => typeof i.engine === "string" && Array.isArray(i.fields), T0);
    if (!r.out) { await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length, cues: -1, ok: false }); return json({ error: "ai", status: r.status, detail: r.detail }, 502); }
    const o = r.out, keep = ["kicker", "title", "sub", "accent", "accent2"], seen = new Set();
    o.fields = (o.fields || []).filter((f: any) => keep.includes(f.k) && !seen.has(f.k) && seen.add(f.k)).map((f: any) => ({ k: f.k, label: String(f.label || f.k).slice(0, 40), type: f.k.startsWith("accent") ? "color" : "text", value: String(f.value || "").slice(0, f.k === "sub" ? 60 : 40) }));
    for (const k of keep) if (!seen.has(k)) o.fields.push({ k, label: k, type: k.startsWith("accent") ? "color" : "text", value: k === "accent" ? "#ffcf6b" : k === "accent2" ? "#7cf5ff" : "" });
    console.log("direct", r.model, o.engine, JSON.stringify(o.footage), JSON.stringify(r.usage));
    await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length + (logo ? 1 : 0), cues: -1, ok: true });
    return json({ direct: o, model: r.model, left: cap - (count || 0) - 1 });
  }
  if (step === "plan") {
    const r = await run(key, PLAN_MODELS, PLAN_SYSTEM, PLAN_TOOL, [...img, { type: "text", text: `${logoLine}\nUser's language: ${lang}. ${want}\n\nThe request:\n${prompt}\n\nCall make_plan now.` }],
      { max_tokens: 9000, output_config: { effort: env("PLAN_EFFORT") || "medium" } }, (i) => Array.isArray(i.shots) && i.shots.length > 1, T0);
    if (!r.out) return json({ error: "ai", status: r.status, detail: r.detail }, 502);
    if (mode !== "auto") r.out.mode = mode;
    return json({ plan: r.out, model: r.model });
  }

  const plan = body?.plan && typeof body.plan === "object" ? JSON.stringify(body.plan).slice(0, 12000) : "";
  if (step === "review") {
    const sc = body?.scene, frames = Array.isArray(body?.frames) ? body.frames.slice(0, 10) : [];
    if (!sc || typeof sc.code !== "string" || !frames.length) return json({ error: "bad review" }, 400);
    const pics: any[] = [];
    for (const f of frames) if (f && typeof f.data === "string" && f.data.length < 400_000) pics.push({ type: "text", text: `Frame at t=${(+f.t).toFixed(1)} s${f.t >= sc.intro ? " (loop)" : ""}:` }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } });
    const rv = await run(key, BUILD_MODELS, BUILD_SYSTEM + REVIEW, TOOL, [...pics, { type: "text", text: `${logoLine}\nUser's language: ${lang}.\n\nThe user's request:\n${prompt}\n\n${plan ? "The director's treatment:\n" + plan + "\n\n" : ""}Your current scene (intro ${sc.intro}s, loop ${sc.loop}s, fields ${JSON.stringify(sc.fields || []).slice(0, 2000)}):\n${sc.code.slice(0, 16000)}${sc.error ? "\n\nIt FAILED to run: " + String(sc.error).slice(0, 400) : ""}\n\nThe frames above are what it renders. Review them as the director, then call make_scene with the corrected, complete scene.` }],
      { max_tokens: 16000, thinking: { type: "between_tools" }, output_config: { effort: env("SCENE_EFFORT") || "high" } }, (i) => typeof i.code === "string" && i.code.length > 50, T0);
    if (!rv.out) return json({ error: "ai", status: rv.status, detail: rv.detail }, 502);
    const s2 = rv.out; s2.intro = Math.min(14, Math.max(2, +s2.intro || 6)); s2.loop = Math.min(12, Math.max(4, +s2.loop || 8));
    console.log("review", rv.model, s2.code.length, "chars");
    if (body?.debug === true) for (let i = 0; i < s2.code.length; i += 3000) console.log("CODE", i / 3000, s2.code.slice(i, i + 3000));
    return json({ scene: s2, model: rv.model });
  }
  const r = await run(key, BUILD_MODELS, BUILD_SYSTEM, TOOL, [...img, { type: "text", text: `${logoLine}\nUser's language: ${lang}.\n\nThe user's request:\n${prompt}\n\n${plan ? "The director's treatment (build exactly this):\n" + plan : "No treatment — design it yourself, cinematic."}\n\nCall make_scene now.` }],
    { max_tokens: 16000, thinking: { type: "between_tools" }, output_config: { effort: env("SCENE_EFFORT") || "high" } }, (i) => typeof i.code === "string" && i.code.length > 50, T0);
  if (!r.out) { await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length, cues: -1, ok: false }); return json({ error: "ai", status: r.status, detail: r.detail }, 502); }
  const scene = r.out; scene.intro = Math.min(14, Math.max(2, +scene.intro || 6)); scene.loop = Math.min(12, Math.max(4, +scene.loop || 8));
  console.log("scene", r.model, scene.mode, scene.code.length, "chars");
  if (body?.debug === true) for (let i = 0; i < scene.code.length; i += 3000) console.log("CODE", i / 3000, scene.code.slice(i, i + 3000));
  await db.from("ai_builds").insert({ user_id: user.id, chars: prompt.length + (logo ? 1 : 0), cues: -1, ok: true });
  return json({ scene, model: r.model, left: cap - (count || 0) - 1 });
});
