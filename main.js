const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configuração de logs para diagnóstico profundo
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

let log;
try {
    log = require('electron-log');
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
} catch (e) {
    console.error("Módulo de log não encontrado. Continuando sem logs de arquivo.");
}

// --- CONFIGURAÇÃO DE SEGURANÇA E REDE ---
if (app.isPackaged) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://trrx-update-server.vercel.app',
        headers: {
            "Cache-Control": "no-cache",
            "X-App-Version": app.getVersion()
        }
    });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false; 

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 1100, minHeight: 700,
    resizable: true, show: false,
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
  });

  mainWindow.webContents.on('dom-ready', () => {
    if (app.isPackaged) {
      setTimeout(() => {
        console.log("[UPDATER] Iniciando busca...");
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
            sendUpdateLog(`ERRO CRÍTICO NA CHAMADA: ${err.message}`, "red");
        });
      }, 5000); 
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const blocked = input.key === 'F12' || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || (input.control && ['R', 'U'].includes(input.key));
    if (blocked) event.preventDefault();
  });
}

// --- FUNÇÃO AUXILIAR DE LOG VISUAL ---
function sendUpdateLog(msg, color = "blue") {
    if (mainWindow) {
        // Log no console do DevTools
        mainWindow.webContents.executeJavaScript(`console.log("%c[UPDATER] ${msg}", "color: ${color === 'red' ? '#ef4444' : '#3b82f6'}; font-weight: bold;")`);
        // Toast se for erro
        if (color === "red") {
            mainWindow.webContents.executeJavaScript(`if(typeof createToast === 'function') createToast("DEBUG: ${msg.substring(0, 30)}...", "red")`);
        }
    }
}

// --- EVENTOS DO AUTO-UPDATER COM LOGS ESPECÍFICOS ---

autoUpdater.on('checking-for-update', () => {
    sendUpdateLog("Conectando ao servidor Hazel...");
});

autoUpdater.on('update-available', (info) => {
    sendUpdateLog(`Nova versão detectada: v${info.version}`, "green");
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
    sendUpdateLog("Nenhuma atualização encontrada (App está atualizado).");
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('download-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', (info) => {
    sendUpdateLog(`Download concluído da v${info.version}. Reiniciando em 3s...`, "green");
    if (mainWindow) mainWindow.webContents.send('update-downloaded');
    setTimeout(() => { autoUpdater.quitAndInstall(false, true); }, 3000);
});

autoUpdater.on('error', (err) => {
    let errorDetail = "Erro desconhecido";
    
    if (err.message.includes("404")) errorDetail = "404: Servidor Hazel não achou a Release ou o latest.yml no GitHub.";
    else if (err.message.includes("401")) errorDetail = "401: Token (TOKEN) na Vercel recusado pelo GitHub.";
    else if (err.message.includes("ENOTFOUND")) errorDetail = "Erro de Conexão: Verifique seu link da Vercel no main.js.";
    else if (err.message.includes("manifest")) errorDetail = "O arquivo latest.yml está corrompido ou incompleto.";
    
    console.error(`[UPDATER ERROR] ${err.stack}`);
    sendUpdateLog(errorDetail, "red");
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });