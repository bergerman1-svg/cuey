/* Desktop: a double-click on a .cuey opens that show (not an empty Cuey), a second double-click while Cuey runs
   opens in the same window, and Cuey starts on the show that was open last. Runs the real app (`electron .`). */
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const res = [];
const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 300) : '')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const show = (title) => JSON.stringify({ app: 'cuey', v: 1, groups: {}, cues: [{ file: title + '.png', type: 'image', name: title, text: { title, bgKind: 'color', bg: '#101014' } }, { file: 'b.png', type: 'image', name: 'Second', text: { title: 'Second', bgKind: 'color', bg: '#101014' } }] });
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuey-open-')), ud = path.join(dir, 'ud');
  const A = path.join(dir, 'Gala night.cuey'), B = path.join(dir, 'Second show.cuey');
  fs.writeFileSync(A, show('Gala')); fs.writeFileSync(B, show('Other'));
  const exe = process.env.CUEY_ELECTRON || require(path.join(process.env.CUEY_NM || path.join(ROOT, 'node_modules'), 'electron'));
  const launch = async (extra) => { const app = await electron.launch({ executablePath: exe, args: [ROOT, '--user-data-dir=' + ud, '--no-sandbox', ...extra], timeout: 60000 }); const pg = await app.firstWindow(); await pg.waitForLoadState('domcontentloaded'); await wait(2500); return { app, pg }; };
  const state = pg => pg.evaluate(() => ({ n: items.length, first: items[0] && items[0].name, name: showName, path: showPath, dirty: isDirty() }));

  // real show files, written the way Cuey itself saves them
  { const { app: a0, pg: p0 } = await launch([]);
    for (const [f, title] of [[A, 'Gala'], [B, 'Other']]) { const js = await p0.evaluate(async raw => { await loadShowFromText(raw); await new Promise(r => setTimeout(r, 700)); return JSON.stringify(showData(), null, 2); }, show(title)); fs.writeFileSync(f, js); }
    await p0.evaluate(() => { items = []; cur = -1; render(); markSaved(); }); await a0.close(); await wait(800); }
  let { app, pg } = await launch([A]);
  let s = await state(pg);
  ok('started with a .cuey file: Cuey opens that show, not an empty list', s.n === 2 && s.first === 'Gala' && s.name === 'Gala night' && s.path === A, s);
  ok('the show is not marked as changed', s.dirty === false, s);
  // a second double-click while Cuey runs → the same window gets the other show
  const second = cp.spawn(exe, [ROOT, '--user-data-dir=' + ud, '--no-sandbox', B], { stdio: 'ignore' });
  await wait(4000);
  s = await state(pg);
  const wins = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  ok('a second double-click opens in the Cuey that is already running (one window)', s.first === 'Other' && s.name === 'Second show' && wins === 1, { s, wins });
  ok('the second copy of Cuey closed itself', second.exitCode !== null || second.killed || await new Promise(r => { second.once('exit', () => r(true)); setTimeout(() => r(false), 3000); }));
  ok('Cuey remembers the open show', await pg.evaluate(() => localStorage.getItem('cuey.lastShow')) === B);
  await app.close(); await wait(800);

  ({ app, pg } = await launch([]));
  s = await state(pg);
  ok('Cuey starts on the show that was open last', s.n === 2 && s.first === 'Other' && s.path === B, s);
  // clearing the list = no show to come back to
  await pg.evaluate(() => { items = []; cur = -1; showPath = null; showName = ''; render(); markSaved(); updateShowTitle(); });
  await wait(300); await app.close(); await wait(800);
  ({ app, pg } = await launch([]));
  s = await state(pg);
  ok('after the list was cleared Cuey starts empty', s.n === 0 && !s.path, s);
  await pg.evaluate(p => localStorage.setItem('cuey.lastShow', p), path.join(dir, 'gone.cuey'));
  await app.close(); await wait(800);
  ({ app, pg } = await launch([]));
  s = await state(pg);
  ok('a last show that no longer exists is ignored quietly', s.n === 0 && await pg.evaluate(() => !localStorage.getItem('cuey.lastShow') && !document.querySelector('.dlg:not([hidden]) #pkList li')), s);
  await app.close();
  console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
