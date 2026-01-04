const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Se instalou o electron-log, mantenha as 2 linhas abaixo. Se não, remova-as.
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// --- Configuração do Hazel (Repositório Privado) ---
if (app.isPackaged) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://trrx-update-server.vercel.app'
    });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false; // Garante que pegue apenas versões estáveis

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
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
  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Verificação com pequeno delay para garantir estabilidade
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 5000); // 5 segundos após abrir
    }
  });

  // --- Bloqueios de Segurança ---
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const blocked = input.key === 'F12' || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || (input.control && ['R', 'U'].includes(input.key));
    if (blocked) event.preventDefault();
  });
}

// --- Eventos do Auto-Updater (Otimizados) ---
autoUpdater.on('update-available', (info) => {
    console.log('Versão nova encontrada:', info.version);
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update-available', info.version);
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('download-progress', progressObj.percent);
    }
});

autoUpdater.on('update-downloaded', () => {
    console.log('Download concluído.');
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('update-downloaded');
    }
});

autoUpdater.on('error', (err) => {
    console.error('Erro no autoUpdater:', err);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});