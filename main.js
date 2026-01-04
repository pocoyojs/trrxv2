const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// --- Configuração do Hazel (Repositório Privado) ---
// Isso força o app a buscar atualizações através da sua ponte na Vercel
if (app.isPackaged) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://trrx-update-server.vercel.app'
    });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    resizable: true,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      devTools: !app.isPackaged,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
    if (app.isPackaged) {
      // Verifica se há atualizações usando a URL do Hazel definida acima
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // --- Eventos do Auto-Updater para a Interface ---
  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', info.version);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('download-progress', progressObj.percent);
  });

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update-downloaded');
    // Opcional: Notificar o usuário via Electron que o app está pronto para reiniciar
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro no autoUpdater:', err);
  });

  // --- Bloqueios de Segurança ---
  win.webContents.on('before-input-event', (event, input) => {
    const blocked = input.key === 'F12' || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || (input.control && ['R', 'U'].includes(input.key));
    if (blocked) event.preventDefault();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});