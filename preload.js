const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cueyNative', {
  platform: process.platform,
  onMenu: (cb) => ipcRenderer.on('menu', (_e, cmd) => cb(cmd)),
  setLang: (l) => ipcRenderer.send('lang', String(l || '')),
  closeNow: () => ipcRenderer.send('close-now'),
  // Free music: watch the Downloads folder for a new song while the user is on Pixabay
  watchDownloads: (on) => ipcRenderer.send('watch-downloads', !!on),
  onDownloaded: (cb) => ipcRenderer.on('downloaded', (_e, d) => cb(d)),
  readDownload: (id) => ipcRenderer.invoke('read-download', id),
  // shows on disk: Save writes the open file, Save As / first save asks where
  saveShow: (o) => ipcRenderer.invoke('show-save', o),
  openShow: () => ipcRenderer.invoke('show-open'),
  readShow: (p) => ipcRenderer.invoke('show-read', p),
  pptxToPdf: (name, data) => ipcRenderer.invoke('pptx-to-pdf', { name, data }),
  setRecent: (names) => ipcRenderer.send('recent', names)
});
