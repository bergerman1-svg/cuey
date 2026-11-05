/* Cuey AI Lab harness — test the AI director + compose engine from a signed-in cuey.live/app tab.
   Load it in that tab (DevTools or Claude in Chrome):
     await import('https://cdn.jsdelivr.net/gh/bergerman1-svg/cuey@next/tests/ai_lab_harness.js')   // or eval the raw file text
   Then:
     await LAB.init()                       // latest `next` engine (or LAB.init(sha))
     const d = await LAB.dir('ערב גאלה ...') // director result (.direct)
     await LAB.show(d)                      // 9-frame grid over the page (screenshot it)
     const v = await LAB.video(d)           // webm blob url (15 fps, 640x360, intro+loop)
     LAB.gallery([{name:'gala', url:v}])    // play videos in an overlay
   Logos: LAB.dir(prompt, {logo:{b64, bg:'#ff551f'}}) sends the logo on its colour to the director;
          LAB.show(d, {logo:{b64}}) gives the engine the transparent logo.
   Nothing here writes to the app's data. Only for Cuey testing. */
(() => {
  const REPO = 'bergerman1-svg/cuey';
  const RAW = sha => `https://raw.githubusercontent.com/${REPO}/${sha}/app/vendor/`;
  const FONTS = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&family=Poppins:wght@500;700;800;900&family=Frank+Ruhl+Libre:wght@300;500;700&family=Secular+One&display=swap';
  const HOST = `<style>html,body{margin:0;background:#000;overflow:hidden}canvas{width:100%;height:100%;display:block}</style><link href="${FONTS}" rel="stylesheet"><canvas id=c width=1920 height=1080></canvas><script>
let D,A={};const inj=s=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=URL.createObjectURL(new Blob([s],{type:'text/javascript'}));e.onload=ok;e.onerror=no;document.head.appendChild(e)});
addEventListener('message',async e=>{const m=e.data;try{
 if(m.lib){await inj(m.three);await inj(m.kit);await inj(m.eng);parent.postMessage({libs:Object.keys(self.ENG)},'*');return}
 if(m.eng){await document.fonts.ready;const n=document.createElement('canvas');n.id='c';n.width=1920;n.height=1080;document.getElementById('c').replaceWith(n);
  A={mood:m.mood||null,lum:m.lum,logo:m.logo||null,intro:ENG.META[m.eng].intro,loop:ENG.META[m.eng].loop};D=await ENG[m.eng](n,m.F,A,self.THREE,self.K);parent.postMessage({ok:A},'*');return}
 if(m.t!=null&&D){if(A.bg&&A.bg!==m.bg)A.bg.close&&A.bg.close();A.bg=m.bg||A.bg;A.bg2=null;D(m.t);
  const bm=await createImageBitmap(document.getElementById('c'),{resizeWidth:m.w||640,resizeHeight:m.h||360});parent.postMessage({bm,t:m.t},'*',[bm])}
}catch(err){parent.postMessage({err:String(err&&err.stack||err)},'*')}});<\/script>`;
  const L = window.LAB = { sha: null, f: null, v: null, D: 0, A: null, w: null };
  L.x = (m, tr) => new Promise(r => { L.w = r; L.f.contentWindow.postMessage(m, '*', tr || []); });
  addEventListener('message', ev => { if (L.f && ev.source === L.f.contentWindow && L.w) { const w = L.w; L.w = null; w(ev.data); } });

  L.latest = async () => (await (await fetch(`https://api.github.com/repos/${REPO}/commits/next`)).json()).sha;
  L.init = async sha => {
    sha = sha || await L.latest(); L.sha = sha;
    const ev = s => { const w = {}; new Function('window', s)(w); return w; };
    const [k, e, mx] = await Promise.all(['kit.js', 'engines.js', 'webm-muxer.js'].map(f => fetch(RAW(sha) + f).then(r => r.text())));
    if (!window.WebMMuxer) new Function(mx + ';window.WebMMuxer=WebMMuxer')();
    L.f && L.f.remove();
    const f = document.createElement('iframe'); f.sandbox = 'allow-scripts';
    f.style.cssText = 'position:fixed;left:-4000px;top:0;width:960px;height:540px;border:0'; f.srcdoc = HOST;
    document.body.appendChild(f); L.f = f; await new Promise(r => f.onload = r);
    if (!L.v) { L.v = document.createElement('video'); L.v.muted = true; L.v.playsInline = true; L.v.crossOrigin = 'anonymous'; }
    const r = await L.x({ lib: 1, three: await three(), kit: ev(k).__KIT_SRC, eng: ev(e).__ENG_SRC });
    return { sha, libs: r.libs };
  };

  L.dir = async (prompt, o = {}) => {
    let logo = false;
    if (o.logo) {
      const im = new Image(); im.src = 'data:image/png;base64,' + o.logo.b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth + 160; c.height = im.naturalHeight + 160;
      const x = c.getContext('2d'); x.fillStyle = o.logo.bg || '#000'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 80, 80);
      logo = { media_type: 'image/png', data: c.toDataURL('image/png').split(',')[1] };
    }
    const r = await fetch(SB_URL + '/functions/v1/ai-director', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() },
      body: JSON.stringify({ prompt, mode: 'scene', lang: o.lang || 'he', logo, step: 'direct' }) });
    const j = await r.json(); if (!j.direct) throw new Error('director: ' + JSON.stringify(j).slice(0, 300)); return j.direct;
  };

  // footage: the clip the director picked (or nothing for drawn backgrounds)
  L.foot = async d => {
    const v = L.v;
    if (d.pick && d.pick.full) { const blob = await pbFetch(d.pick.full); v.src = URL.createObjectURL(blob); await new Promise(r => v.onloadeddata = r); L.D = v.duration; }
    else { const c = document.createElement('canvas'); c.width = 64; c.height = 36; c.getContext('2d').fillRect(0, 0, 64, 36); L.blank = c; L.D = 30; L.still = true; return; }
    L.still = false;
  };
  const frame = async () => L.still ? createImageBitmap(L.blank) : createImageBitmap(L.v);
  const seek = t => new Promise(r => { if (L.still) return r(); const tt = Math.min(L.D - .05, Math.max(0, t)); if (Math.abs(L.v.currentTime - tt) < .002) return r(); L.v.onseeked = () => r(); L.v.currentTime = tt; setTimeout(r, 3000); });
  L.lum = async () => { if (L.still) return .1; await seek(Math.min(3, L.D / 2)); const c = new OffscreenCanvas(32, 18), x = c.getContext('2d'); x.drawImage(L.v, 0, 0, 32, 18); const p = x.getImageData(0, 0, 32, 18).data; let s = 0; for (let i = 0; i < p.length; i += 4) s += (.2126 * p[i] + .7152 * p[i + 1] + .0722 * p[i + 2]) / 255; return s / (p.length / 4); };
  const logoBm = async o => { if (!o || !o.logo) return null; const im = new Image(); im.src = 'data:image/png;base64,' + o.logo.b64; await im.decode(); return createImageBitmap(im); };

  L.load = async (d, o = {}) => {
    await L.foot(d);
    const F = {}; d.fields.forEach(f => F[f.k] = f.value); F.look = d.look;
    const r = await L.x({ eng: d.engine || 'compose', F, logo: await logoBm(o), mood: d.mood || null, lum: await L.lum() });
    if (r.err) throw new Error(r.err); L.A = r.ok; return r.ok;
  };
  L.at = async (t, w, h) => { const rt = L.still ? 1 : Math.min(1, (L.D - .3) / (L.A.intro + L.A.loop)); await seek(t * rt); const bg = await frame(); const q = await L.x({ t, bg, w, h }, [bg]); if (q.err) throw new Error(q.err); return q.bm; };
  L.times = () => { const I = L.A.intro, P = L.A.loop; return [.6, I * .25, I * .45, I * .65, I * .85, I, I + P * .25, I + P * .5, I + P * .85]; };

  L.overlay = (id, html) => { document.getElementById(id)?.remove(); const g = document.createElement('div'); g.id = id; g.dir = 'rtl';
    g.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0b0b10;overflow:auto;padding:16px;font-family:Heebo,system-ui,sans-serif;color:#fff';
    g.innerHTML = '<button style="position:fixed;top:10px;left:10px;z-index:2;padding:6px 14px;border-radius:8px;border:0;cursor:pointer">✕</button>' + html;
    g.querySelector('button').onclick = () => g.remove(); document.body.appendChild(g); return g; };
  // 9 frames over the page — screenshot to judge
  L.show = async (d, o = {}) => {
    await L.load(d, o); const g = L.overlay('__labgrid', '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px"></div>'), box = g.lastChild;
    for (const t of L.times()) { const bm = await L.at(t); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.style.width = '100%'; c.getContext('2d').drawImage(bm, 0, 0); bm.close(); box.appendChild(c); }
    return true;
  };
  // the whole intro + loop as a webm (blob url)
  L.video = async (d, o = {}) => {
    await L.load(d, o); const FPS = o.fps || 15, W = o.w || 640, H = o.h || 360, T = L.A.intro + L.A.loop, N = Math.round(T * FPS);
    const mux = new WebMMuxer.Muxer({ target: new WebMMuxer.ArrayBufferTarget(), video: { codec: 'V_VP9', width: W, height: H, frameRate: FPS } });
    const enc = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: e => console.error(e) });
    enc.configure({ codec: 'vp09.00.10.08', width: W, height: H, bitrate: 2500000, framerate: FPS });
    for (let i = 0; i < N; i++) { const bm = await L.at(i / FPS, W, H); const vf = new VideoFrame(bm, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(vf, { keyFrame: i % 45 === 0 }); vf.close(); bm.close(); L.prog = (i + 1) + '/' + N; }
    await enc.flush(); mux.finalize(); return URL.createObjectURL(new Blob([mux.target.buffer], { type: 'video/webm' }));
  };
  L.gallery = items => L.overlay('__labgal', '<h2 style="margin:4px 0 14px">Cuey AI Lab</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px">' +
    items.map(i => `<div style="background:#16161e;border-radius:12px;padding:10px"><div style="margin-bottom:6px">${i.name}</div><video src="${i.url}" controls loop muted autoplay playsinline style="width:100%;border-radius:8px;background:#000"></video><a download="cuey-${i.name}.webm" href="${i.url}" style="color:#9cf;font-size:14px">⬇ שמור</a></div>`).join('') + '</div>');
})();
