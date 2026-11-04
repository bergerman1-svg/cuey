/* Cuey site — motion layer (4.11.2026). Adds, without changing the page's content:
   1. moving stage-light beams behind the hero
   2. a working Cuey in the hero (press GO / Space) — the real layout: cue list, PROGRAM, NEXT, BACK/GO/FREEZE/BLACK
   3. a soft glow that follows the mouse on the feature cards, and sections that rise gently as they scroll in
   Respects prefers-reduced-motion; draws only while visible. Used by / and /he/. */
(function () {
  var hero = document.querySelector('header.hero'); if (!hero) return;
  var HE = (document.documentElement.lang || '').indexOf('he') === 0 || document.documentElement.dir === 'rtl';
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FF = HE ? "'Heebo','Poppins',system-ui,sans-serif" : "'Poppins',system-ui,sans-serif";

  /* ---------- styles ---------- */
  var css = "" +
  "header.hero{isolation:isolate}" +
  "#cmBeams{position:absolute;left:50%;top:-80px;width:min(1600px,100vw);height:calc(100% + 80px);transform:translateX(-50%);z-index:-1;pointer-events:none;opacity:.85}" +
  ".cm{max-width:860px;margin:28px auto 8px;text-align:start;direction:ltr}" +
  ".cm .hint{font:500 12px 'JetBrains Mono',monospace;color:var(--mut,#9A9AA8);text-align:center;margin-bottom:10px;direction:" + (HE ? "rtl" : "ltr") + "}" +
  ".cm .hint b{color:var(--go,#C8FF00)}" +
  ".cmw{background:linear-gradient(180deg,#141419,#0E0E12);border:1px solid #2A2A34;border-radius:18px;box-shadow:0 40px 120px -30px rgba(0,0,0,.9);overflow:hidden;font-family:" + FF + "}" +
  ".cmb{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #2A2A34;font-size:12px;color:#9A9AA8}" +
  ".cmb i{width:10px;height:10px;border-radius:50%;background:#2c2c35;display:inline-block;margin-right:6px}" +
  ".cmb .t{font-weight:600;color:#cfcfd8}.cmb .live{margin-left:auto;border:1px solid #C8FF00;color:#C8FF00;border-radius:7px;padding:3px 8px;white-space:nowrap}" +
  ".cmg{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.6fr);gap:12px;padding:12px}" +
  ".cml{display:flex;flex-direction:column;gap:6px;min-width:0}" +
  ".cmc{display:grid;grid-template-columns:20px 64px minmax(0,1fr);gap:8px;align-items:center;padding:6px;border-radius:10px;border:1px solid transparent;background:#16161c;cursor:pointer;color:inherit;font:inherit;text-align:" + (HE ? "right" : "left") + "}" +
  ".cmc:hover{background:#1c1c24}.cmc .n{font:700 10px 'JetBrains Mono',monospace;color:#62626e}" +
  ".cmc canvas{width:64px;height:36px;border-radius:5px;display:block;background:#000}" +
  ".cmc .nm{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#F2F2F5;direction:" + (HE ? "rtl" : "ltr") + "}" +
  ".cmc .tg{font:500 9.5px 'JetBrains Mono',monospace;color:#62626e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".cmc.live{border-color:#C8FF00;background:#191f0b}.cmc.live .n{color:#C8FF00}.cmc.next{border-color:rgba(255,117,31,.55)}" +
  ".cmr{display:flex;flex-direction:column;gap:12px;min-width:0}" +
  ".cmm{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:10px;align-items:end}" +
  ".cmo{position:relative;border-radius:10px;overflow:hidden;background:#000;border:1px solid #2A2A34}" +
  ".cmo canvas{display:block;width:100%;height:auto;aspect-ratio:16/9}" +
  ".cmo .tag{position:absolute;top:8px;left:8px;font:700 9.5px 'JetBrains Mono',monospace;letter-spacing:.12em;padding:3px 7px;border-radius:6px;background:rgba(0,0,0,.55)}" +
  ".cmo.p{border-color:rgba(200,255,0,.5);box-shadow:0 0 40px -10px rgba(200,255,0,.35)}.cmo.p .tag{color:#C8FF00;border:1px solid #C8FF00}.cmo.x .tag{color:#FF751F;border:1px solid #FF751F}" +
  ".cmk{display:grid;grid-template-columns:1fr 1.6fr 1fr 1fr;gap:8px}" +
  ".cmk button{border:1px solid #2A2A34;background:#17171d;color:#dcdce4;border-radius:10px;padding:14px 6px;font:700 12px/1 " + FF + ";letter-spacing:.06em;cursor:pointer;transition:transform .08s}" +
  ".cmk button:active{transform:scale(.97)}.cmk .go{background:#C8FF00;color:#0A0A0C;border-color:#C8FF00;font-size:22px;font-weight:900;letter-spacing:0;position:relative}" +
  ".cmk .go.pulse::after{content:'';position:absolute;inset:-6px;border-radius:14px;border:2px solid #C8FF00;animation:cmRing 1.6s ease-out infinite}" +
  "@keyframes cmRing{from{opacity:.9;transform:scale(.96)}to{opacity:0;transform:scale(1.12)}}" +
  ".cmk .on{background:#2a1010;border-color:#ff3b30;color:#ffb3ad}" +
  ".cmf{padding:0 14px 12px;font:500 11px 'JetBrains Mono',monospace;color:#62626e}" +
  "@media (max-width:700px){.cmg{grid-template-columns:minmax(0,1fr)}.cml{flex-direction:row;overflow-x:auto;order:2;scrollbar-width:none}.cml::-webkit-scrollbar{display:none}" +
  ".cmc{grid-template-columns:56px;flex:0 0 auto;width:72px;justify-items:center;gap:4px}.cmc .n,.cmc .tg{display:none}.cmc .nm{font-size:10px;max-width:64px}.cmc canvas{width:56px;height:32px}" +
  ".cmm{grid-template-columns:minmax(0,1fr)}.cmo.x{display:none}}" +
  ".card{position:relative;overflow:hidden}.card::after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(240px circle at var(--mx,50%) var(--my,-40%),rgba(200,255,0,.10),transparent 60%)}" +
  ".cm-rise{transform:translateY(18px);transition:transform .8s cubic-bezier(.2,.8,.2,1)}.cm-rise.in{transform:none}" +
  "@media (prefers-reduced-motion:reduce){#cmBeams{display:none}.cmk .go.pulse::after{animation:none}.cm-rise{transform:none;transition:none}}";
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- the show ---------- */
  var CUES = HE ? [
    { nm: 'לופ כניסה', tg: 'Loop · Dissolve 0.8s', kick: 'ערב השקה · 2026', title: 'ברוכים הבאים', line: 'פתיחת דלתות · 19:00', bg: ['#16204f', '#05071a'], acc: '#C8FF00', look: 'frame' },
    { nm: 'דברי פתיחה', tg: 'Dissolve 0.8s · GO', kick: 'דברי פתיחה', title: 'נועה אברהם', line: 'מנכ"לית', bg: ['#3a1f6b', '#0b0620'], acc: '#FF751F', look: 'words' },
    { nm: 'השנה במספרים.mp4', tg: 'Video · Next', kind: 'numbers', label: 'אירועים השנה', bg: ['#0b0b0e', '#000'], acc: '#C8FF00' },
    { nm: 'פרס', tg: 'Dissolve 0.8s · GO', kick: 'עובד השנה', title: 'יונתן כהן', line: 'הצלחת לקוחות', bg: ['#5a3a06', '#120a00'], acc: '#F5C542', look: 'words' },
    { nm: 'תודה', tg: 'Hold · Fade', kick: 'נתראה בשנה הבאה', title: 'תודה רבה!', line: 'ערב השקה 2026', bg: ['#0f3b3a', '#03100f'], acc: '#C8FF00', look: 'shine' }
  ] : [
    { nm: 'Walk-in loop', tg: 'Loop · Dissolve 0.8s', kick: 'LAUNCH NIGHT · 2026', title: 'Welcome', line: 'Doors open · 19:00', bg: ['#16204f', '#05071a'], acc: '#C8FF00', look: 'frame' },
    { nm: 'Opening words', tg: 'Dissolve 0.8s · Waits for GO', kick: 'OPENING WORDS', title: 'Noa Abraham', line: 'CEO', bg: ['#3a1f6b', '#0b0620'], acc: '#FF751F', look: 'letters' },
    { nm: 'Year in numbers.mp4', tg: 'Video · Then next', kind: 'numbers', label: 'EVENTS RUN THIS YEAR', bg: ['#0b0b0e', '#000'], acc: '#C8FF00' },
    { nm: 'Award', tg: 'Dissolve 0.8s · Waits for GO', kick: 'EMPLOYEE OF THE YEAR', title: 'Jonathan Cohen', line: 'Customer Success', bg: ['#5a3a06', '#120a00'], acc: '#F5C542', look: 'words' },
    { nm: 'Thank you', tg: 'Hold · Fade to black', kick: 'SEE YOU NEXT YEAR', title: 'Thank you!', line: 'Launch Night 2026', bg: ['#0f3b3a', '#03100f'], acc: '#C8FF00', look: 'shine' }
  ];
  function cl(v, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v)); }
  function k(t, a, b) { return cl((t - a) / (b - a)); }
  function eo(v) { return 1 - Math.pow(1 - v, 3); }
  function back(v) { var s = 1.7; return 1 + (s + 1) * Math.pow(v - 1, 3) + s * Math.pow(v - 1, 2); }
  function hexA(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function txt(x, s, cx, y, size, w, col, al, ls) { x.save(); x.direction = HE ? 'rtl' : 'ltr'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = w + ' ' + size + 'px ' + FF; x.globalAlpha = al === undefined ? 1 : al; x.fillStyle = col; if (ls && 'letterSpacing' in x) x.letterSpacing = ls + 'px'; x.fillText(s, cx, y); x.restore(); }
  function bg(x, W, H, c, t) {
    var g = x.createRadialGradient(W * .5, H * .42, W * .02, W * .5, H * .5, W * .75); g.addColorStop(0, c.bg[0]); g.addColorStop(1, c.bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (var i = 0; i < 14; i++) { var a = i * 1.7 + t * .3, px = ((i * 271) % 97) / 97 * W + Math.sin(a) * W * .03, py = ((i * 157) % 89) / 89 * H + Math.cos(a * 1.3) * H * .04, r = W * (.03 + ((i * 37) % 50) / 1000), gg = x.createRadialGradient(px, py, 0, px, py, r), al = .10 + .07 * Math.sin(t * 1.4 + i); gg.addColorStop(0, hexA(c.acc, al)); gg.addColorStop(1, hexA(c.acc, 0)); x.fillStyle = gg; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
    var v = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  }
  function drawCue(x, W, H, i, t) {
    var c = CUES[i], s = W / 1920, cx = W / 2; bg(x, W, H, c, t);
    if (c.kind === 'numbers') {
      var n = Math.round(eo(k(t, .2, 2.4)) * 1284); txt(x, n.toLocaleString('en-US'), cx, H * .42, 320 * s, 900, '#fff'); txt(x, c.label, cx, H * .64, 46 * s, 700, c.acc, eo(k(t, .6, 1.2)), 10 * s);
      for (var j = 0; j < 12; j++) { var h = H * .12 * (.3 + .7 * Math.abs(Math.sin(j * 1.3))) * eo(k(t, .3 + j * .06, 1.2 + j * .06)); x.fillStyle = hexA(c.acc, .55); x.fillRect(W * .29 + j * W * .036, H * .9 - h, W * .022, h); }
      return;
    }
    var K = H * .30, T = H * .47, L = H * .64, ts = 150 * s;
    txt(x, c.kick, cx, K, 40 * s, 800, c.acc, eo(k(t, .1, .6)), HE ? 0 : 8 * s);
    if (c.look === 'letters' && !HE) {
      x.save(); x.font = '900 ' + ts + 'px ' + FF; x.textBaseline = 'middle'; var ch = Array.from(c.title), full = x.measureText(c.title).width, px = cx - full / 2;
      ch.forEach(function (q, j) { var w = x.measureText(q).width, v = k(t, .3 + j * .05, .85 + j * .05), b = back(v); x.save(); x.globalAlpha = cl(v * 2); x.translate(px + w / 2, T + (1 - b) * -100 * s); x.scale(1, .6 + .4 * b); x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(q, 0, 0); x.restore(); px += w; }); x.restore();
    } else if (c.look === 'words') {
      x.save(); x.font = '900 ' + ts + 'px ' + FF; x.textBaseline = 'middle'; x.direction = HE ? 'rtl' : 'ltr'; var ws = c.title.split(' '), sp = x.measureText(' ').width, tot = x.measureText(c.title).width, p2 = HE ? cx + tot / 2 : cx - tot / 2;
      x.beginPath(); x.rect(0, T - ts * .7, W, ts * 1.4); x.clip();
      ws.forEach(function (w, j) { var ww = x.measureText(w).width, v = eo(k(t, .35 + j * .22, 1 + j * .22)); x.textAlign = HE ? 'right' : 'left'; x.fillStyle = '#fff'; x.fillText(w, p2, T + (1 - v) * ts * 1.2); p2 += HE ? -(ww + sp) : ww + sp; }); x.restore();
    } else {
      var a = eo(k(t, .2, 1)); txt(x, c.title, cx, T + (1 - a) * 30 * s, ts, 900, '#fff', a);
      if (c.look === 'shine' && t > 1.1) { var p = ((t - 1.1) % 3) / 3; x.save(); x.beginPath(); x.rect(0, T - ts * .7, W, ts * 1.4); x.clip(); var sx = -W * .2 + p * W * 1.4, g = x.createLinearGradient(sx - W * .09, 0, sx + W * .09, 0); g.addColorStop(0, 'rgba(255,250,220,0)'); g.addColorStop(.5, 'rgba(255,250,220,.6)'); g.addColorStop(1, 'rgba(255,250,220,0)'); x.globalCompositeOperation = 'lighter'; x.direction = HE ? 'rtl' : 'ltr'; x.font = '900 ' + ts + 'px ' + FF; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = g; x.fillText(c.title, cx, T); x.restore(); }
      if (c.look === 'frame') { var fw = W * .62, fh = H * .56, x0 = cx - fw / 2, y0 = H * .19, per = 2 * (fw + fh), vv = eo(k(t, .1, 1.3)); x.save(); x.strokeStyle = c.acc; x.lineWidth = Math.max(1.5, 4 * s); x.shadowColor = c.acc; x.shadowBlur = (14 + 6 * Math.sin(t * 2.4)) * s * 2; x.setLineDash([per * vv, per]); x.beginPath(); x.moveTo(cx, y0); x.lineTo(x0 + fw, y0); x.lineTo(x0 + fw, y0 + fh); x.lineTo(x0, y0 + fh); x.lineTo(x0, y0); x.lineTo(cx, y0); x.stroke(); x.restore(); }
    }
    x.fillStyle = c.acc; var rv = eo(k(t, 1, 1.6)); x.fillRect(cx - 130 * s * rv, H * .565, 260 * s * rv, 5 * s);
    txt(x, c.line, cx, L, 52 * s, 400, '#E6EAFF', eo(k(t, 1.2, 1.8)));
  }

  /* ---------- the console ---------- */
  var box = document.createElement('div'); box.className = 'cm';
  box.innerHTML = '<p class="hint">' + (HE ? 'זה Cuey אמיתי — <b>לחצו GO</b> (או רווח)' : 'This is a real Cuey layout — <b>press GO</b> (or Space)') + '</p>' +
    '<div class="cmw" role="region" aria-label="Cuey demo"><div class="cmb"><span><i></i><i></i><i></i></span><span class="t">' + (HE ? 'ערב השקה.cuey' : 'Launch Night.cuey') + '</span><span class="live">● Event screen live</span></div>' +
    '<div class="cmg"><div class="cml"></div><div class="cmr"><div class="cmm"><div class="cmo p"><canvas width="640" height="360"></canvas><span class="tag">PROGRAM</span></div><div class="cmo x"><canvas width="400" height="225"></canvas><span class="tag">NEXT</span></div></div>' +
    '<div class="cmk"><button type="button" data-a="back">◀ BACK</button><button type="button" class="go pulse" data-a="go">GO ▶</button><button type="button" data-a="freeze">FREEZE</button><button type="button" data-a="black">BLACK</button></div></div></div>' +
    '<div class="cmf"></div></div>';
  var anchor = hero.querySelector('.who');
  hero.insertBefore(box, anchor);
  var list = box.querySelector('.cml'), cvs = box.querySelectorAll('.cmo canvas'), pgm = cvs[0], nxt = cvs[1], px = pgm.getContext('2d'), nx = nxt.getContext('2d'), foot = box.querySelector('.cmf'), goBtn = box.querySelector('.go');
  CUES.forEach(function (c, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'cmc'; b.innerHTML = '<span class="n">0' + (i + 1) + '</span><canvas width="128" height="72"></canvas><span style="min-width:0"><div class="nm"></div><div class="tg"></div></span>'; b.querySelector('.nm').textContent = c.nm; b.querySelector('.tg').textContent = c.tg; b.addEventListener('click', function () { take(); set(i); }); list.appendChild(b); });
  var rows = Array.prototype.slice.call(list.children);
  var cur = -1, prev = -1, t0 = 0, tp = 0, black = false, frozen = false, fAt = 0, auto = true, timer = null, vis = true;
  function now() { return performance.now() / 1000; }
  function set(i) { i = (i + CUES.length) % CUES.length; prev = cur; tp = t0; cur = i; t0 = now(); black = false; frozen = false; sync(); kick(); }
  function sync() {
    rows.forEach(function (el, i) { el.classList.toggle('live', i === cur); el.classList.toggle('next', i === (cur + 1) % CUES.length); });
    box.querySelector('[data-a=black]').classList.toggle('on', black); box.querySelector('[data-a=freeze]').classList.toggle('on', frozen);
    foot.textContent = auto ? (HE ? 'הדגמה אוטומטית · לחצו GO כדי לקחת שליטה' : 'Auto demo · press GO to take over') : (HE ? 'אתם מפעילים את המופע' : 'You are running the show');
    var r = rows[cur]; if (r && list.scrollWidth > list.clientWidth) list.scrollTo({ left: r.offsetLeft - list.clientWidth / 2 + r.offsetWidth / 2, behavior: RM ? 'auto' : 'smooth' });
  }
  function take() { if (!auto) return; auto = false; clearInterval(timer); goBtn.classList.remove('pulse'); sync(); }
  box.querySelector('.cmk').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; take(); var a = b.dataset.a; if (a === 'go') set(cur + 1); else if (a === 'back') set(cur - 1); else if (a === 'black') { black = !black; sync(); kick(); } else { frozen = !frozen; fAt = now(); sync(); kick(); } });
  addEventListener('keydown', function (e) { if (!vis || (e.target.closest && e.target.closest('input,textarea,select,a,button,video'))) return; if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); take(); set(cur + 1); } else if (e.key === 'ArrowLeft') { take(); set(cur - 1); } else if (e.key === 'b' || e.key === 'B') { take(); black = !black; sync(); kick(); } });

  /* ---------- beams ---------- */
  var bc = document.createElement('canvas'); bc.id = 'cmBeams'; bc.setAttribute('aria-hidden', 'true'); hero.insertBefore(bc, hero.firstChild); var bx = bc.getContext('2d');
  function sizeB() { var r = bc.getBoundingClientRect(), sc = innerWidth < 700 ? .35 : .5; bc.width = Math.max(1, r.width * sc); bc.height = Math.max(1, r.height * sc); }
  function beams() { var W = bc.width, H = bc.height, t = now(); bx.clearRect(0, 0, W, H); bx.globalCompositeOperation = 'lighter';
    [[.14, '200,255,0', .10], [.5, '255,117,31', .06], [.86, '200,255,0', .08]].forEach(function (b, i) { var ang = Math.sin(t * .25 + i * 2) * .26, len = H * 1.3; bx.save(); bx.translate(W * b[0], 0); bx.rotate(ang); var g = bx.createLinearGradient(0, 0, 0, len); g.addColorStop(0, 'rgba(' + b[1] + ',' + b[2] * 2 + ')'); g.addColorStop(1, 'rgba(' + b[1] + ',0)'); bx.fillStyle = g; bx.beginPath(); bx.moveTo(-W * .008, 0); bx.lineTo(W * .008, 0); bx.lineTo(W * .13, len); bx.lineTo(-W * .13, len); bx.closePath(); bx.fill(); bx.restore(); });
    bx.globalCompositeOperation = 'source-over'; }

  /* ---------- loop ---------- */
  var raf = 0;
  function lt() { return frozen ? fAt - t0 : now() - t0; }
  function frame() { raf = 0;
    px.fillStyle = '#000'; px.fillRect(0, 0, pgm.width, pgm.height);
    var t = lt(), d = k(t, 0, .8);
    if (prev >= 0 && d < 1) { drawCue(px, pgm.width, pgm.height, prev, now() - tp); px.globalAlpha = eo(d); drawCue(px, pgm.width, pgm.height, cur, t); px.globalAlpha = 1; } else drawCue(px, pgm.width, pgm.height, cur, t);
    if (black) { px.fillStyle = '#000'; px.fillRect(0, 0, pgm.width, pgm.height); }
    drawCue(nx, nxt.width, nxt.height, (cur + 1) % CUES.length, now() % 6 + 2);
    if (!RM) beams();
    if (!RM && vis) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function autoRun() { clearInterval(timer); if (RM) return; timer = setInterval(function () { if (auto && vis && !document.hidden) set(cur + 1); }, 4200); }
  new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis) { if (auto) autoRun(); kick(); } else clearInterval(timer); }, { threshold: .05 }).observe(hero);
  addEventListener('resize', sizeB);

  /* ---------- cards + sections ---------- */
  if (!RM) {
    document.querySelectorAll('.card').forEach(function (c) { c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .08 });
    document.querySelectorAll('section > h2, section .grid, section .lead').forEach(function (el) { el.classList.add('cm-rise'); io.observe(el); });
  }

  function start() { sizeB(); rows.forEach(function (el, i) { var cv = el.querySelector('canvas'); drawCue(cv.getContext('2d'), cv.width, cv.height, i, 6); }); set(0); autoRun(); if (RM) frame(); }
  var fl = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('900 40px ' + (HE ? 'Heebo' : 'Poppins')), document.fonts.load('400 40px ' + (HE ? 'Heebo' : 'Poppins'))]) : Promise.resolve();
  Promise.race([fl, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
