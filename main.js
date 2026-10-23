const { app, BrowserWindow, screen, Menu, shell, ipcMain } = require('electron');
const path = require('path');

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
    child.on('closed', () => { if (win && !win.isDestroyed()) win.focus(); });
  });

  win.on('closed', () => { win = null; });
}

const template = [
  ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
  { label: 'Show', submenu: [
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu', 'open') },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win && win.webContents.send('menu', 'save') },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => win && win.webContents.send('menu', 'saveas') },
      { type: 'separator' },
      { label: 'Export Show MP4…', click: () => win && win.webContents.send('menu', 'export') },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
  ]},
  { label: 'Cue', submenu: [
      { label: 'Move Up', accelerator: 'Alt+Up', click: () => win && win.webContents.send('menu', 'up') },
      { label: 'Move Down', accelerator: 'Alt+Down', click: () => win && win.webContents.send('menu', 'down') },
      { label: 'Duplicate Cue', accelerator: 'CmdOrCtrl+D', click: () => win && win.webContents.send('menu', 'dup') },
      { label: 'Remove', click: () => win && win.webContents.send('menu', 'del') },
      { type: 'separator' },
      { label: 'Select All', click: () => win && win.webContents.send('menu', 'selall') },
      { label: 'Clear All List…', click: () => win && win.webContents.send('menu', 'clear') },
      { type: 'separator' },
      { label: 'Create Slide Show', click: () => win && win.webContents.send('menu', 'slideshow') }
  ]},
  { label: 'Output', submenu: [
      { label: 'Output Window', accelerator: 'CmdOrCtrl+Shift+O', click: () => win && win.webContents.send('menu', 'output') },
      { label: 'Share Output Screen…', click: () => win && win.webContents.send('menu', 'share') },
      { type: 'separator' },
      { label: 'Black', click: () => win && win.webContents.send('menu', 'black') },
      { role: 'togglefullscreen' }
  ]},
  { role: 'viewMenu' },
  { role: 'windowMenu' },
  { role: 'help', submenu: [{ label: 'Keyboard Shortcuts', click: () => win && win.webContents.send('menu', 'keys') }, { label: 'About Cuey', click: () => win && win.webContents.send('menu', 'about') }, { type: 'separator' }, { label: 'Cuey Website', click: () => shell.openExternal('https://bergerman1-svg.github.io/cuey/') }] }
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
