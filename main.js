const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configuração de logs profissional
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App iniciando...');

// Configurações Globais do AutoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

let mainWindow;

/**
 * FUNÇÃO DE LOG DE FORÇA BRUTA (GIGANTE NA TELA)
 * Injeta um terminal de diagnóstico diretamente no HTML para capturar o erro exato.
 */
function bruteForceLog(msg, isError = false) {
    console.log(`[UPDATER DEBUG] ${msg}`);
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        const bgColor = isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(10, 10, 12, 0.9)';
        const textColor = isError ? '#ffff00' : '#00ff00';
        
        const script = `
            (function() {
                let dbg = document.getElementById('trrx-debug-log');
                if(!dbg) {
                    dbg = document.createElement('div');
                    dbg.id = 'trrx-debug-log';
                    dbg.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:999999; background:${bgColor}; color:${textColor}; padding:40px; font-family:monospace; font-size:14px; overflow-y:auto; pointer-events:none; display:flex; flex-direction:column; gap:10px; border: 5px solid ${isError ? 'white' : '#3b82f6'};';
                    document.body.appendChild(dbg);
                    
                    const title = document.createElement('h1');
                    title.innerText = "SISTEMA DE DIAGNÓSTICO AUTO-UPDATE";
                    title.style.fontSize = "24px";
                    title.style.marginBottom = "20px";
                    dbg.appendChild(title);
                }
                const line = document.createElement('div');
                line.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom:5px; word-break:break-all;';
                line.innerText = "[" + new Date().toLocaleTimeString() + "] " + ${JSON.stringify(msg)};
                dbg.appendChild(line);
                dbg.scrollTop = dbg.scrollHeight;
            })();
        `;
        mainWindow.webContents.executeJavaScript(script).catch(e => console.error("Falha ao injetar log:", e));
    }
}

function sendToUI(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send(channel, data);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 800,
        minWidth: 1100, minHeight: 700,
        resizable: true, show: false,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
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
        bruteForceLog("Ambiente: " + (app.isPackaged ? "PRODUÇÃO" : "DESENVOLVIMENTO"));
        bruteForceLog("Versão Instalada: " + app.getVersion());

        if (app.isPackaged) {
            setTimeout(() => {
                bruteForceLog("Chamando autoUpdater.checkForUpdatesAndNotify()...");
                autoUpdater.checkForUpdatesAndNotify().catch(err => {
                    bruteForceLog("ERRO CRÍTICO NA CHAMADA INICIAL: " + err.stack, true);
                });
            }, 4000); 
        } else {
            bruteForceLog("Auto-update ignorado: O app não está empacotado.");
        }
    });

    // Bloqueios de segurança
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (app.isPackaged) {
            const blocked = input.key === 'F12' || (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || (input.control && ['R', 'U'].includes(input.key));
            if (blocked) event.preventDefault();
        }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ==========================================
//        EVENTOS DO AUTO-UPDATER
// ==========================================

autoUpdater.on('checking-for-update', () => {
    bruteForceLog("Conectando ao GitHub para verificar o arquivo latest.yml...");
});

autoUpdater.on('update-available', (info) => {
    bruteForceLog("SUCESSO: Nova versão detectada!");
    bruteForceLog("Versão encontrada: v" + info.version);
    bruteForceLog("Release Date: " + info.releaseDate);
    sendToUI('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
    bruteForceLog("O servidor respondeu: Você já possui a versão mais recente.");
});

autoUpdater.on('download-progress', (progressObj) => {
    bruteForceLog(`Progresso: ${Math.floor(progressObj.percent)}% | Velocidade: ${Math.floor(progressObj.bytesPerSecond / 1024)} KB/s`);
    sendToUI('download-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', (info) => {
    bruteForceLog("DOWNLOAD COMPLETO: Preparando instalação...", false);
    bruteForceLog("O aplicativo irá reiniciar em 5 segundos.");
    sendToUI('update-downloaded');
    
    setTimeout(() => {
        if (app.isPackaged) {
            autoUpdater.quitAndInstall(false, true);
        }
    }, 5000);
});

autoUpdater.on('error', (err) => {
    log.error('Erro fatal no Updater:', err);
    bruteForceLog("FALHA NO AUTO-UPDATE!", true);
    bruteForceLog("MENSAGEM: " + err.message, true);
    bruteForceLog("STACK TRACE: " + err.stack, true);
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