const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cueyNative', {
  platform: process.platform,
  onMenu: (cb) => ipcRenderer.on('menu', (_e, cmd) => cb(cmd))
});
