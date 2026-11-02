/* Cuey for Windows, on a real Windows machine (GitHub's windows-latest), driven like a user.
   Avi, 2.11.2026: "a Windows PC is less available to me" → every change is checked on Windows in the cloud.
   Runs the INSTALLED app (node tests/win_desktop_e2e.js "C:\...\Cuey.exe") or, with no argument, `electron .`.
   Screenshots go to win-shots/ (uploaded by CI) so the Windows look can be checked by eye. */
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs');
const exe = process.argv[2];
const ROOT = path.join(__dirname, '..'), FIX = path.join(__dirname, 'fixtures'), OUT = path.join(ROOT, 'win-shots');
fs.mkdirSync(OUT, { recursive: true });
const want = require(path.join(ROOT, 'package.json')).version;
const res = [];
const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x !== undefined ? '  -> ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const info = (n, x) => console.log('INFO ' + n + ': ' + (typeof x === 'string' ? x : JSON.stringify(x)));
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const app = await electron.launch(exe ? { executablePath: exe, args: [], timeout: 60000 } : { args: [ROOT], timeout: 60000 });
  const errs = [];
  let pg = await app.firstWindow();
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.waitForLoadState('domcontentloaded'); await wait(2500);
  // first run: skip the tour, then start clean
  await pg.evaluate(() => { try { localStorage.setItem('cuey.tour', 'done') } catch (e) {} });
  await pg.reload(); await pg.waitForLoadState('domcontentloaded'); await wait(2500);
  await pg.screenshot({ path: path.join(OUT, '01-start.png') });

  // ---- the app itself
  const nat = await pg.evaluate(() => ({ p: window.cueyNative && cueyNative.platform, ver: (document.querySelector('.ver') || {}).textContent }));
  ok('runs as the desktop app on Windows', nat.p === 'win32', nat);
  ok(`shows the right version (v${want})`, (nat.ver || '').includes(want), nat.ver);
  const menu = await app.evaluate(({ Menu }) => { const m = Menu.getApplicationMenu(); return m ? m.items.map(i => i.label) : [] });
  ok('has its menu bar', menu.length >= 4, menu);
  const wb = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; const b = w.getBounds(); return { w: b.width, h: b.height, vis: w.isVisible() } });
  ok('main window is visible and a usable size', wb.vis && wb.w >= 900 && wb.h >= 600, wb);

  // ---- Hebrew
  await pg.evaluate(() => setLang('he')); await wait(400);
  ok('switches to Hebrew', await pg.evaluate(() => document.body.classList.contains('he')));
  const menuHe = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(i => i.label));
  ok('menu bar follows to Hebrew', menuHe.some(l => /[\u0590-\u05FF]/.test(l)), menuHe);

  // ---- files in
  await pg.setInputFiles('#fileIn', ['red.png', 'green.png', 'va.webm', 'tone.wav'].map(f => path.join(FIX, f)));
  await wait(2500);
  const n1 = await pg.evaluate(() => items.length);
  ok('pictures, a video and music go into the list', n1 === 4, n1);
  await pg.setInputFiles('#fileIn', [path.join(FIX, 'deck.pdf')]); await wait(6000);
  const n2 = await pg.evaluate(() => items.length);
  ok('a PDF opens into one cue per page', n2 > n1, { before: n1, after: n2 });
  ok('every cue got its picture', await pg.evaluate(() => items.every(i => i.thumb || i.bad)), await pg.evaluate(() => items.map(i => [i.name, !!i.thumb, !!i.bad])));
  await pg.screenshot({ path: path.join(OUT, '02-list-he.png') });

  // ---- GO / back / black / freeze
  await pg.click('#go'); await wait(800);
  ok('GO puts the first cue live', await pg.evaluate(() => cur === 0));
  await pg.click('#go'); await wait(800);
  ok('GO again → the next cue', await pg.evaluate(() => cur === 1));
  await pg.click('#back'); await wait(800);
  ok('back → the cue before', await pg.evaluate(() => cur === 0));
  await pg.click('#blk'); await wait(300);
  ok('black screen on', await pg.evaluate(() => document.querySelector('#blk').classList.contains('on')));
  await pg.click('#blk'); await wait(300);
  ok('black screen off', await pg.evaluate(() => !document.querySelector('#blk').classList.contains('on')));
  await pg.evaluate(() => show(items.findIndex(i => i.type === 'video'))); await wait(1500);
  const vid = await pg.evaluate(() => [...document.querySelectorAll('video')].map(v => ({ t: +v.currentTime.toFixed(2), p: v.paused, e: v.error && v.error.code })));
  ok('the video plays on Windows', vid.some(v => v.t > 0.4 && !v.p), vid);
  await pg.click('#frz'); await wait(300);
  ok('freeze holds the video', await pg.evaluate(() => frozen === true));
  await pg.click('#frz'); await wait(300);
  await pg.evaluate(() => show(items.findIndex(i => i.type === 'audio'))); await wait(2000);
  ok('music plays', await pg.evaluate(() => !slideAudio.paused && slideAudio.currentTime > 0.3), await pg.evaluate(() => ({ p: slideAudio.paused, t: slideAudio.currentTime, e: slideAudio.error && slideAudio.error.code })));
  await pg.screenshot({ path: path.join(OUT, '03-live-he.png') });

  // ---- the event screen (the runner has one screen → Cuey asks, we choose "show it here")
  const before = app.windows().length;
  await pg.click('#openOut'); await wait(1500);
  const q = await pg.evaluate(() => { const d = document.querySelector('#extQ'); return d ? d.innerText : '' });
  info('one-screen question', q.replace(/\s+/g, ' ').slice(0, 160));
  if (q) { await pg.click('#extQ [data-v="here"]'); await wait(2500); }
  ok('after "show it here", no second "only one screen" message', await pg.evaluate(() => { const d = document.querySelector('#scDlg'); return !d || d.hidden }));
  const wins = app.windows();
  ok('the event screen window opens', wins.length > before, { before, after: wins.length });
  const out = wins.find(w => w !== pg);
  if (out) {
    await pg.evaluate(() => show(0)); await wait(1500);
    await out.screenshot({ path: path.join(OUT, '04-event-screen.png') });
    const lit = await out.evaluate(() => { const s = document.querySelector('#stage'); return !!s && s.children.length > 0 });
    ok('the event screen shows the live cue', lit);
  }

  // ---- PowerPoint on a PC with no PowerPoint installed: a clear message, nothing breaks
  const n3 = await pg.evaluate(() => items.length);
  await pg.setInputFiles('#fileIn', [path.join(FIX, 'deck.pptx')]); await wait(20000);
  const n4 = await pg.evaluate(() => items.length);
  const msg = await pg.evaluate(() => [...document.querySelectorAll('.flash,.toast,.uiq,.dlg:not([hidden])')].map(e => e.innerText).join(' | ').slice(0, 300));
  info('PowerPoint without Office', { added: n4 - n3, message: msg });
  ok('PowerPoint without Office: the show keeps running', await pg.evaluate(() => cur >= 0) && n4 >= n3);
  await pg.screenshot({ path: path.join(OUT, '05-pptx.png') });

  // ---- English look
  await pg.evaluate(() => setLang('en')); await wait(400);
  await pg.screenshot({ path: path.join(OUT, '06-live-en.png') });

  ok('no errors in the app', errs.length === 0, errs.slice(0, 3));
  const pass = res.filter(Boolean).length;
  console.log(`\n${pass}/${res.length} passed`);
  await Promise.race([app.close(), wait(8000)]);
  try { app.process().kill() } catch (e) {}
  process.exit(pass === res.length ? 0 : 1);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
