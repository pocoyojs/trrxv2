const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, version) => callback(event, version)),
  onUpdateProgress: (callback) => ipcRenderer.on('download-progress', (event, percent) => callback(event, percent)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event) => callback(event))
});