const { contextBridge, ipcRenderer } = require('electron');

// Expõe funções seguras para o seu site (index.html/script.js)
contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onUpdateProgress: (callback) => ipcRenderer.on('download-progress', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
});