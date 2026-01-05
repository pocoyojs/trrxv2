const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configuração de logs profissional
const log = require('electron-log');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App iniciando...');

// Configurações Globais do AutoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

let mainWindow;

/**
 * Função utilitária para enviar mensagens para o front-end com segurança.
 * Verifica se a janela ainda existe antes de tentar a comunicação,
 * evitando erros do tipo "Cannot read property of null".
 */
function sendToUI(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send(channel, data);
    }
}

/**
 * Função para registrar logs no console do DevTools do usuário em tempo real.
 */
function logToUI(msg, color = "blue") {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(`
            console.log("%c[UPDATER] ${msg}", "color: ${color === 'red' ? '#ef4444' : '#3b82f6'}; font-weight: bold;");
        `).catch(() => {});
        
        if (color === "red") {
            mainWindow.webContents.executeJavaScript(`
                if(typeof createToast === 'function') createToast("${msg}", "red");
            `).catch(() => {});
        }
    }
}

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
    });

    /**
     * O sistema de update só inicia quando o DOM está 100% pronto.
     * Isso garante que os listeners no script.js já foram registrados
     * antes de enviarmos os sinais de atualização.
     */
    mainWindow.webContents.on('dom-ready', () => {
        if (app.isPackaged) {
            setTimeout(() => {
                logToUI("Verificando atualizações no GitHub...");
                autoUpdater.checkForUpdatesAndNotify().catch(err => {
                    logToUI(`Erro na conexão de update: ${err.message}`, "red");
                });
            }, 5000); // Delay de 5s para garantir estabilidade da conexão
        }
    });

    // Bloqueios de segurança para ferramentas de desenvolvedor em produção
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (app.isPackaged) {
            const blocked = input.key === 'F12' || 
                           (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || 
                           (input.control && ['R', 'U'].includes(input.key));
            if (blocked) event.preventDefault();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ==========================================
//        EVENTOS DO AUTO-UPDATER
// ==========================================

autoUpdater.on('checking-for-update', () => {
    log.info('Checando versão...');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update disponível encontrado.');
    logToUI(`Nova versão v${info.version} detectada!`, "green");
    sendToUI('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
    log.info('App atualizado.');
    logToUI("Sistema já está na versão mais recente.");
});

autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Baixando: ${progressObj.percent}%`);
    sendToUI('download-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Download concluído.');
    logToUI(`v${info.version} baixada. Reiniciando para aplicar...`, "green");
    sendToUI('update-downloaded');
    
    // Força a instalação automática após 5 segundos
    setTimeout(() => {
        if (app.isPackaged) {
            autoUpdater.quitAndInstall(false, true);
        }
    }, 5000);
});

autoUpdater.on('error', (err) => {
    log.error('Erro fatal no Updater:', err);
    logToUI(`FALHA NO AUTO-UPDATE: ${err.message}`, "red");
});

// ==========================================
//        INICIALIZAÇÃO DO APP
// ==========================================

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});