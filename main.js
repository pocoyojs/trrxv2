const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configuração de logs para diagnóstico de erros no repositório privado
// Certifique-se de ter rodado: npm install electron-log
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// --- Configuração do Hazel (Repositório Privado) ---
// O Hazel serve como ponte para o seu repositório privado no GitHub
if (app.isPackaged) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://trrx-update-server.vercel.app'
    });
}

// Configurações de comportamento do Updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false; // Busca apenas versões estáveis (Published)

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

  // Evento disparado quando a janela é exibida pela primeira vez
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // CORREÇÃO CRUCIAL: Só inicia a busca por atualizações quando o DOM (HTML/JS) estiver pronto
  // Isso evita que o sinal de "update-available" seja enviado antes do script.js estar ouvindo.
  mainWindow.webContents.on('dom-ready', () => {
    if (app.isPackaged) {
      console.log("Monitorando atualizações via Hazel...");
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 5000); // Delay de 5 segundos para garantir estabilidade da conexão
    }
  });

  // --- Bloqueios de Segurança ---
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const blocked = input.key === 'F12' || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || (input.control && ['R', 'U'].includes(input.key));
    if (blocked) event.preventDefault();
  });
}

// --- Eventos do Auto-Updater (Comunicação com o script.js via Preload) ---

autoUpdater.on('checking-for-update', () => {
    console.log('Verificando se há novas versões...');
});

// COMUNICAÇÃO COM O FRONT-END
autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('download-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('update-downloaded');
    // ESTILO DISCORD: Fecha e instala após 3 segundos do download concluído
    setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
    }, 3000);
});

autoUpdater.on('error', (err) => {
    console.error('Erro crítico no autoUpdater:', err);
});

// Inicialização do App
app.whenReady().then(createWindow);

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});