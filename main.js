const { app, BrowserWindow, screen, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let uiLang = 'en', appQuitting = false;
ipcMain.on('lang', (_e, l) => { uiLang = l === 'he' ? 'he' : 'en'; });
app.on('before-quit', () => { appQuitting = true; });
// the page saved after "Save" in the close question → now really close / quit
ipcMain.on('close-now', () => { if (appQuitting) app.quit(); else if (win && !win.isDestroyed()) win.close(); });

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
ipcMain.handle('show-open', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: SHOW_F });
  if (r.canceled || !r.filePaths[0]) return null;
  const f = r.filePaths[0];
  return { path: f, name: path.basename(f), text: await fs.promises.readFile(f, 'utf8') };
});
ipcMain.handle('show-read', async (_e, f) => { if (!isShow(f)) return null; try { return await fs.promises.readFile(f, 'utf8'); } catch (e) { return null; } });
let recentNames = [];
ipcMain.on('recent', (_e, names) => { recentNames = Array.isArray(names) ? names.slice(0, 8).map(String) : []; Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate())); });
ipcMain.handle('read-download', async (_e, id) => { const f = dlOk.get(String(id)); if (!f) return null; dlOk.delete(String(id)); try { return await fs.promises.readFile(f); } catch (e) { return null; } });

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
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
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
    const onAdd = (_e, d) => { if (child.isDestroyed()) return; const b = d.bounds; child.setFullScreen(false); child.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); child.setFullScreen(true); };
    screen.on('display-added', onAdd);
    child.on('closed', () => screen.removeListener('display-added', onAdd));
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
    else { if (c === 0) win.webContents.send('menu', 'savequit'); appQuitting = false; }  // save first, or stay
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
  { role: 'help', submenu: [{ label: 'Keyboard Shortcuts', click: () => win && win.webContents.send('menu', 'keys') }, { label: 'About Cuey', click: () => win && win.webContents.send('menu', 'about') }, { type: 'separator' }, { label: 'Cuey Website', click: () => shell.openExternal('https://cuey.live/') }] }
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
