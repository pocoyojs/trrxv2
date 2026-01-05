const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// CORREÇÃO 1: Carregamento único e protegido do logger
// Evita que o app quebre caso o módulo electron-log não seja encontrado ou falhe
let log;
try {
    log = require('electron-log');
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
} catch (e) {
    console.warn("Módulo electron-log não disponível. Usando console padrão.");
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

  // CORREÇÃO 2: Verificação de Update vinculada ao DOM-READY
  // Garante que o sinal de "update-available" só seja enviado quando o HTML/JS estiver pronto para ouvir
  mainWindow.webContents.on('dom-ready', () => {
    if (app.isPackaged) {
      setTimeout(() => {
        sendUpdateLog("Iniciando busca de atualizações...", "blue");
        autoUpdater.checkForUpdatesAndNotify().catch(err => {
            sendUpdateLog(`ERRO NA CHAMADA: ${err.message}`, "red");
        });
      }, 5000); 
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const blocked = input.key === 'F12' || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || (input.control && ['R', 'U'].includes(input.key));
    if (blocked) event.preventDefault();
  });
}

// CORREÇÃO 3: Função de log protegida contra destruição da janela
// Impede erros de "Cannot read properties of null" se o evento ocorrer enquanto o app fecha
function sendUpdateLog(msg, color = "blue") {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(`
            console.log("%c[UPDATER] ${msg}", "color: ${color === 'red' ? '#ef4444' : '#3b82f6'}; font-weight: bold;");
        `).catch(() => {});

        if (color === "red") {
            // REMOVIDO O SUBSTRING: Agora envia o erro completo sem cortes
            mainWindow.webContents.executeJavaScript(`
                if(typeof createToast === 'function') createToast("${msg}", "red");
            `).catch(() => {});
        }
    }
}

// --- EVENTOS DO AUTO-UPDATER COM PROTEÇÃO DE ESTADO ---

autoUpdater.on('checking-for-update', () => {
    sendUpdateLog("Conectando ao servidor Hazel...");
});

autoUpdater.on('update-available', (info) => {
    sendUpdateLog(`Versão v${info.version} detectada.`, "green");
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', info.version); //
    }
});

autoUpdater.on('update-not-available', () => {
    sendUpdateLog("App está na última versão.");
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', progressObj.percent); //
    }
});

autoUpdater.on('update-downloaded', (info) => {
    sendUpdateLog(`Download da v${info.version} pronto. Reiniciando...`, "green");
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded'); //
    }
    // ESTILO DISCORD: Instalação automática após download
    setTimeout(() => { 
        if (app.isPackaged) autoUpdater.quitAndInstall(false, true); 
    }, 3000);
});

autoUpdater.on('error', (err) => {
    console.error(`[UPDATER ERROR] ${err.stack}`);
    sendUpdateLog(`ERRO: ${err.message}`, "red"); //
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});