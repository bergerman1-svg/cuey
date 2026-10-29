const { app, BrowserWindow, screen, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let uiLang = 'en', appQuitting = false, quitAfterSave = false;
ipcMain.on('lang', (_e, l) => { uiLang = l === 'he' ? 'he' : 'en'; });
app.on('before-quit', () => { appQuitting = true; });
// the page saved after "Save" in the close question → now really close / quit
ipcMain.on('close-now', () => { if (appQuitting || quitAfterSave) { quitAfterSave = false; app.quit(); } else if (win && !win.isDestroyed()) win.close(); });

// ---- Free music: while the user is on Pixabay, a new song in Downloads is handed to the page (only those files)
const AUDIO = /\.(mp3|wav|m4a|aac|ogg)$/i;
let dlWatch = null, dlTimer = null, dlSeen = new Map(), dlOk = new Map(), dlId = 0;
function stopDl() { try { dlWatch && dlWatch.close(); } catch (e) {} dlWatch = null; clearTimeout(dlTimer); }
ipcMain.on('watch-downloads', (_e, on) => {
  stopDl(); if (!on) return;
  const dir = app.getPath('downloads'); const t0 = Date.now();
  try {
    dlWatch = fs.watch(dir, (_ev, name) => {
      if (!name || !AUDIO.test(name) || dlSeen.has(name)) return;
      dlSeen.set(name, 1);   // one hand-off per file, even when the folder reports it several times
      const full = path.join(dir, name);
      // wait until the file stops growing, then pass it on once
      let last = -1, tries = 0;
      const check = () => { fs.stat(full, (err, st) => {
        if (err || !st.isFile() || st.mtimeMs < t0 - 2000) { if (++tries < 4) setTimeout(check, 700); else dlSeen.delete(name); return; }
        if (st.size > 0 && st.size === last) { const id = String(++dlId); dlOk.set(id, full);
          if (win && !win.isDestroyed()) win.webContents.send('downloaded', { id, name }); return; }
        last = st.size; if (++tries < 120) setTimeout(check, 700); }); };
      setTimeout(check, 500);
    });
  } catch (e) { return; }
  dlTimer = setTimeout(stopDl, 20 * 60 * 1000);   // stop watching after 20 minutes
});
// ---- shows (.cuey) on disk
const SHOW_F = [{ name: 'Cuey show', extensions: ['cuey'] }];
const isShow = (p) => typeof p === 'string' && /\.cuey$/i.test(p);
ipcMain.handle('show-save', async (_e, o) => {
  let target = o && isShow(o.path) ? o.path : null;
  if (!target) {
    const nm = String((o && o.name) || 'show').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'show';
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), nm + '.cuey'), filters: SHOW_F });
    if (r.canceled || !r.filePath) return null;
    target = /\.cuey$/i.test(r.filePath) ? r.filePath : r.filePath + '.cuey';
  }
  await fs.promises.writeFile(target, String(o.json), 'utf8');
  return { path: target, name: path.basename(target) };
});
// Show media folder: next to "My show.cuey" sits "My show media/". Every save puts the cues that exist only inside Cuey there
// (PDF pages, PowerPoint videos, library backgrounds); "Save with all media…" copies every file, so the show opens on another computer.
const mediaDir = (showPath) => showPath.replace(/\.cuey$/i, '') + ' media';
const safeName = (n) => path.basename(String(n || '')).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 180);
ipcMain.handle('pack-media', async (_e, o) => {
  if (!o || !isShow(o.showPath)) return { error: 'no show' };
  const dir = mediaDir(o.showPath); let n = 0;
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    for (const f of (o.files || [])) {
      const nm = safeName(f.name); if (!nm) continue; const to = path.join(dir, nm);
      try {
        if (f.path) { const st = await fs.promises.stat(f.path); let same = false; try { same = (await fs.promises.stat(to)).size === st.size; } catch (_) {} if (!same) await fs.promises.copyFile(f.path, to); n++; }
        else if (f.data) { let same = false; try { same = (await fs.promises.stat(to)).size === f.data.byteLength; } catch (_) {} if (!same) await fs.promises.writeFile(to, Buffer.from(f.data)); n++; }
      } catch (e) { return { error: String(e && e.message || e), dir, count: n }; }
    }
    return { dir, count: n };
  } catch (e) { return { error: String(e && e.message || e) }; }
});
ipcMain.handle('read-media', async (_e, o) => {
  if (!o || !isShow(o.showPath)) return null;
  const f = path.join(mediaDir(o.showPath), safeName(o.name));
  try { return await fs.promises.readFile(f); } catch (e) { return null; }
});
ipcMain.handle('show-open', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: SHOW_F });
  if (r.canceled || !r.filePaths[0]) return null;
  const f = r.filePaths[0];
  return { path: f, name: path.basename(f), text: await fs.promises.readFile(f, 'utf8') };
});
// PowerPoint → PDF with what is already on the computer (Keynote / PowerPoint on Mac, PowerPoint on Windows, LibreOffice anywhere).
// The app then turns the PDF into slide cues exactly like a dropped PDF. Nothing is uploaded anywhere.
const { execFile } = require('child_process');
const os = require('os');
const run = (cmd, args, ms = 180000) => new Promise((res) => execFile(cmd, args, { timeout: ms, windowsHide: true }, (err, out, er) => res({ ok: !err, out: String(out || ''), err: String(er || (err && err.message) || '') })));
const asq = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
async function pptxToPdf(inp, outPdf) {
  const tried = [];
  if (process.platform === 'darwin') {
    const k = await run('osascript', ['-e', `tell application "Keynote"
  set d to open (POSIX file "${asq(inp)}")
  export d to (POSIX file "${asq(outPdf)}") as PDF with properties {PDF image quality:Best}
  close d saving no
end tell`]);
    tried.push('Keynote: ' + (k.ok ? 'ok' : k.err.slice(0, 160)));
    if (k.ok && fs.existsSync(outPdf)) return { via: 'Keynote', tried };
    const pp = await run('osascript', ['-e', `tell application "Microsoft PowerPoint"
  open (POSIX file "${asq(inp)}")
  set p to active presentation
  save p in (POSIX file "${asq(outPdf)}") as save as PDF
  close p saving no
end tell`]);
    tried.push('PowerPoint: ' + (pp.ok ? 'ok' : pp.err.slice(0, 160)));
    if (pp.ok && fs.existsSync(outPdf)) return { via: 'PowerPoint', tried };
  }
  if (process.platform === 'win32') {
    const ps = `$ErrorActionPreference='Stop';$pp=New-Object -ComObject PowerPoint.Application;$p=$pp.Presentations.Open('${inp.replace(/'/g, "''")}',$true,$false,$false);$p.SaveAs('${outPdf.replace(/'/g, "''")}',32);$p.Close();if($pp.Presentations.Count -eq 0){$pp.Quit()}`;
    const w = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
    tried.push('PowerPoint: ' + (w.ok ? 'ok' : w.err.slice(0, 160)));
    if (w.ok && fs.existsSync(outPdf)) return { via: 'PowerPoint', tried };
  }
  const soffice = process.platform === 'darwin' ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice'] : process.platform === 'win32' ? ['C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'] : ['soffice', 'libreoffice'];
  for (const so of soffice) {
    if (path.isAbsolute(so) && !fs.existsSync(so)) continue;
    const l = await run(so, ['--headless', '--convert-to', 'pdf', '--outdir', path.dirname(outPdf), inp]);
    const made = path.join(path.dirname(outPdf), path.basename(inp).replace(/\.pptx$/i, '.pdf'));
    tried.push('LibreOffice: ' + (l.ok ? 'ok' : l.err.slice(0, 160)));
    if (l.ok && fs.existsSync(made)) { if (made !== outPdf) fs.renameSync(made, outPdf); return { via: 'LibreOffice', tried }; }
  }
  return { via: null, tried };
}
ipcMain.handle('pptx-to-pdf', async (_e, o) => {
  if (!o || !/\.pptx$/i.test(o.name || '') || !o.data) return { error: 'bad input' };
  // try the temp folder first; Mac apps are sandboxed, so if Keynote/PowerPoint can't reach it, retry in a hidden folder in Documents (removed right after)
  const bases = [path.join(os.tmpdir(), 'cuey-convert'), path.join(os.homedir(), 'Documents', '.cuey-convert')];
  let last = null;
  for (const base of bases) {
    const dir = path.join(base, String(Date.now()));
    try {
      fs.mkdirSync(dir, { recursive: true });
      const inp = path.join(dir, 'slides.pptx'), out = path.join(dir, 'slides.pdf');
      fs.writeFileSync(inp, Buffer.from(o.data));
      const r = await pptxToPdf(inp, out); last = r;
      if (r.via) { const pdf = fs.readFileSync(out); fs.rmSync(dir, { recursive: true, force: true }); return { pdf, via: r.via }; }
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) { last = { tried: [String(e && e.message || e)] }; try { fs.rmSync(dir, { recursive: true, force: true }) } catch (_) {} }
  }
  return { error: 'no converter', tried: last && last.tried };
});
ipcMain.handle('show-read', async (_e, f) => { if (!isShow(f)) return null; try { return await fs.promises.readFile(f, 'utf8'); } catch (e) { return null; } });
let recentNames = [];
ipcMain.on('recent', (_e, names) => { recentNames = Array.isArray(names) ? names.slice(0, 8).map(String) : []; Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate())); });
ipcMain.handle('read-download', async (_e, id) => { const f = dlOk.get(String(id)); if (!f) return null; dlOk.delete(String(id)); try { return await fs.promises.readFile(f); } catch (e) { return null; } });

// Continue with Google in the desktop app: Google only signs in on a real web address, so the button opens
// cuey.live/app/desktop-signin.html in the normal browser; after sign-in that page sends the session back to a
// one-time server on this computer (127.0.0.1, random port, random state that must match). Nothing leaves the computer.
const http = require('http');
const crypto = require('crypto');
let gWait = null;
const SIGNIN_PAGE = process.env.CUEY_SIGNIN_PAGE || 'https://cuey.live/app/desktop-signin.html';
const doneHtml = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cuey</title>
<body style="margin:0;background:#0A0A0C;color:#F2F2F5;font:18px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center">
<div><div style="font:800 34px system-ui;color:#C8FF00">Cuey</div><p id="m">…</p></div>
<script>const h=location.hash.slice(1);history.replaceState(null,'','/cb');
fetch('/done',{method:'POST',headers:{'Content-Type':'text/plain'},body:h}).then(r=>r.ok?r.text():Promise.reject()).then(()=>{document.getElementById('m').innerHTML='Signed in — you can go back to Cuey and close this tab.<br><span dir="rtl">התחברתם — אפשר לחזור ל-Cuey ולסגור את הלשונית.</span>'}).catch(()=>{document.getElementById('m').textContent='Something went wrong — try again from Cuey. · משהו השתבש — נסו שוב מתוך Cuey.'})</script></body>`;
ipcMain.handle('google-signin', async (_e, o) => {
  if (gWait) { try { gWait.cancel(); } catch (_) {} }
  const lang = o && o.lang === 'he' ? 'he' : 'en';
  const state = crypto.randomBytes(24).toString('hex');
  return await new Promise((resolve) => {
    let done = false;
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && u.pathname === '/cb') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); return res.end(doneHtml); }
      if (req.method === 'POST' && u.pathname === '/done') {
        let b = ''; req.on('data', (c) => { b += c; if (b.length > 20000) req.destroy(); });
        req.on('end', () => {
          const q = new URLSearchParams(b);
          const st = q.get('state') || '';
          const ok = st.length === state.length && crypto.timingSafeEqual(Buffer.from(st), Buffer.from(state)) && q.get('access_token') && q.get('refresh_token');
          if (!ok) { res.writeHead(400); return res.end('no'); }
          res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
          finish({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_in: +q.get('expires_in') || 3600 });
          if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); app.focus && app.focus({ steal: true }); }
        });
        return;
      }
      res.writeHead(404); res.end();
    });
    const timer = setTimeout(() => finish({ error: 'timeout' }), 5 * 60 * 1000);
    function finish(r) { if (done) return; done = true; clearTimeout(timer); gWait = null; setTimeout(() => { try { srv.close(); } catch (_) {} }, 1500); resolve(r); }
    gWait = { cancel: () => finish({ error: 'cancelled' }) };
    srv.on('error', () => finish({ error: 'server' }));
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      shell.openExternal(`${SIGNIN_PAGE}?port=${port}&state=${state}&lang=${lang}`);
    });
  });
});
ipcMain.handle('google-cancel', () => { if (gWait) gWait.cancel(); return true; });

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    backgroundColor: '#0A0A0C',
    title: 'Cuey',
    // the Cuey top bar IS the window title bar — no double bar (Mac: traffic lights inside it; Windows: min/max/close drawn over its right end)
    titleBarStyle: process.platform === 'linux' ? 'default' : 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 19 } } : {}),
    ...(process.platform === 'win32' ? { titleBarOverlay: { color: '#0F0F13', symbolColor: '#C9C9D3', height: 52 } } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,   // keep playback + export timers accurate when not focused
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.loadFile(path.join(__dirname, 'app', 'cuey.html'));

  // The Output window is opened by the page with window.open('', 'cuey_output').
  // Put it on the second display (if there is one) as a frameless fullscreen window.
  win.webContents.setWindowOpenHandler(({ frameName, url }) => {
    if (frameName !== 'cuey_output') {
      if (/^(https?:\/\/|mailto:)/.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    }
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const ext = displays.find(d => d.id !== primary.id);
    const target = ext || primary;
    const b = target.bounds;
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        x: b.x, y: b.y, width: ext ? b.width : 960, height: ext ? b.height : 540,
        frame: !ext, fullscreen: !!ext, alwaysOnTop: !!ext, backgroundColor: '#000000',
        title: 'Cuey — Output', autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
      }
    };
  });

  win.webContents.on('did-create-window', (child) => {
    child.setMenuBarVisibility(false);
    // a screen plugged in (or back) while the show runs → move the Output there, full screen
    const onAdd = (_e, d) => { if (child.isDestroyed()) return; const b = d.bounds; child.setFullScreen(false); child.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); child.setFullScreen(true); child.setAlwaysOnTop(true); };
    // the event screen unplugged mid-show → never leave a full-screen black window over the operator's laptop:
    // shrink the Output to a small window in the corner of the laptop screen and give the focus back to Cuey
    const onRemove = () => {
      if (child.isDestroyed()) return;
      const primary = screen.getPrimaryDisplay();
      if (screen.getAllDisplays().some(d => d.id !== primary.id)) return;
      const wa = primary.workArea, w = 480, h = 270;
      child.setAlwaysOnTop(false); child.setFullScreen(false);
      setTimeout(() => { if (child.isDestroyed()) return; child.setBounds({ x: wa.x + wa.width - w - 24, y: wa.y + wa.height - h - 24, width: w, height: h }); if (win && !win.isDestroyed()) win.focus(); }, 300);
    };
    screen.on('display-added', onAdd);
    screen.on('display-removed', onRemove);
    child.on('closed', () => { screen.removeListener('display-added', onAdd); screen.removeListener('display-removed', onRemove); });
    child.on('closed', () => { if (win && !win.isDestroyed()) win.focus(); });
  });

  // unsaved show: the page blocks the close (beforeunload) → ask Save / Don't save / Cancel
  win.webContents.on('will-prevent-unload', (e) => {
    const he = uiLang === 'he';
    const c = dialog.showMessageBoxSync(win, { type: 'question', buttons: he ? ['שמירה', 'בלי לשמור', 'ביטול'] : ['Save', "Don't Save", 'Cancel'],
      defaultId: 0, cancelId: 2, noLink: true,
      message: he ? 'לשמור את השינויים בהופעה לפני הסגירה?' : 'Save the changes to this show before closing?',
      detail: he ? 'אם לא שומרים, השינויים האחרונים יאבדו.' : 'If you don’t save, your latest changes will be lost.' });
    if (c === 1) e.preventDefault();                       // close without saving
    else { if (c === 0) { quitAfterSave = appQuitting; win.webContents.send('menu', 'savequit'); } appQuitting = false; }  // save first (and finish the quit if ⌘Q started it), or stay
  });
  win.on('closed', () => { win = null; stopDl(); });
}

const send = (c) => () => win && win.webContents.send('menu', c);
const menuTemplate = () => [
  ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
  { label: 'Show', submenu: [
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu', 'open') },
      { label: 'Open Recent', submenu: recentNames.length ? recentNames.map((n, i) => ({ label: n, click: send('recent:' + i) })) : [{ label: '(none yet)', enabled: false }] },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win && win.webContents.send('menu', 'save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => win && win.webContents.send('menu', 'saveas') },
      { label: 'Save with All Media (for another computer)…', click: () => win && win.webContents.send('menu', 'savepack') },
      { type: 'separator' },
      { label: 'Export Show MP4…', click: () => win && win.webContents.send('menu', 'export') },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
  ]},
  // Edit menu: on a Mac, ⌘C / ⌘V / ⌘X / ⌘A in text fields only work when the app has one (pasting a YouTube link, typing a title…)
  { role: 'editMenu' },
  { label: 'Cue', submenu: [
      { label: 'Move Up', accelerator: 'Alt+Up', click: () => win && win.webContents.send('menu', 'up') },
      { label: 'Move Down', accelerator: 'Alt+Down', click: () => win && win.webContents.send('menu', 'down') },
      { label: 'Duplicate Cue', accelerator: 'CmdOrCtrl+D', click: () => win && win.webContents.send('menu', 'dup') },
      { label: 'Remove', click: () => win && win.webContents.send('menu', 'del') },
      { type: 'separator' },
      { label: 'Select All', click: () => win && win.webContents.send('menu', 'selall') },
      { label: 'Clear All List…', click: () => win && win.webContents.send('menu', 'clear') },
      { type: 'separator' },
      { label: 'Create Slide Show', click: () => win && win.webContents.send('menu', 'slideshow') },
      { type: 'separator' },
      { label: 'Add Cue From', submenu: [
        { label: 'Computer…', click: send('add-pc') }, { label: 'YouTube / Vimeo Link…', click: send('add-link') },
        { label: 'PDF / PowerPoint…', click: send('add-pdf') }, { label: 'Create Cue…', click: send('add-card') },
        { label: 'Free Music…', click: send('add-music') }, { label: 'AI Builder…', click: send('add-ai') } ] }
  ]},
  { label: 'Output', submenu: [
      { label: 'Output Window', accelerator: 'CmdOrCtrl+Shift+O', click: () => win && win.webContents.send('menu', 'output') },
      { label: 'Close Output', click: send('closeout') },
      { label: 'Share Output Screen…', click: () => win && win.webContents.send('menu', 'share') },
      { type: 'separator' },
      { label: 'Black', click: () => win && win.webContents.send('menu', 'black') },
      { role: 'togglefullscreen' }
  ]},
  { role: 'viewMenu' },
  { role: 'windowMenu' },
  { role: 'help', submenu: [{ label: 'Keyboard Shortcuts', click: () => win && win.webContents.send('menu', 'keys') }, { label: 'Quick Tour', click: () => win && win.webContents.send('menu', 'tour') }, { label: 'Contact Support', click: () => shell.openExternal('mailto:support@cuey.live?subject=' + encodeURIComponent('Cuey support ' + app.getVersion())) }, { label: 'About Cuey', click: () => win && win.webContents.send('menu', 'about') }, { type: 'separator' }, { label: 'Cuey Website', click: () => shell.openExternal('https://cuey.live/') }] }
];

app.whenReady().then(() => {
  // YouTube / Vimeo players refuse to run inside a page without a web address (error 153). The app is a local file,
  // so we tell those two players which site the request comes from.
  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube-nocookie.com/*', 'https://www.youtube.com/*', 'https://player.vimeo.com/*'] },
    (d, cb) => { d.requestHeaders['Referer'] = 'https://cuey.live/'; cb({ requestHeaders: d.requestHeaders }); });
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
