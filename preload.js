const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cueyNative', {
  platform: process.platform,
  onMenu: (cb) => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
  setLang: (l) => ipcRenderer.send('lang', String(l || '')),
  closeNow: () => ipcRenderer.send('close-now'),
  // Free music: watch the Downloads folder for a new song while the user is on Pixabay
  watchDownloads: (on) => ipcRenderer.send('watch-downloads', !!on),
  onDownloaded: (cb) => ipcRenderer.on('downloaded', (_e, d) => cb(d)),
  readDownload: (id) => ipcRenderer.invoke('read-download', id)
});
