const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configuração de logs
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// --- CONFIGURAÇÃO DE SEGURANÇA E REDE (CORREÇÃO PARA REPO PRIVADO) ---
if (app.isPackaged) {
    autoUpdater.setFeedURL({
        provider: "github",
        owner: "pocoyojs",
        repo: "trrxv2",
        private: true // OBRIGATÓRIO para repositórios privados
    });
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

let mainWindow;

/**
 * FUNÇÃO DE LOG DE FORÇA BRUTA (GIGANTE NA TELA)
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
                bruteForceLog("Iniciando busca no GitHub (Modo Autenticado)...");
                autoUpdater.checkForUpdatesAndNotify().catch(err => {
                    bruteForceLog("ERRO NA CHAMADA: " + err.message, true);
                    if(err.message.includes("404")) {
                        bruteForceLog("DICA: Erro 404 em repo privado geralmente significa GH_TOKEN ausente no Build.", true);
                    }
                });
            }, 4000); 
        }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// --- EVENTOS DO AUTO-UPDATER ---
autoUpdater.on('checking-for-update', () => bruteForceLog("Verificando atualizações..."));
autoUpdater.on('update-available', (info) => {
    bruteForceLog("SUCESSO: v" + info.version + " encontrada!");
    sendToUI('update-available', info.version);
});
autoUpdater.on('update-not-available', () => bruteForceLog("Você já está na última versão."));
autoUpdater.on('download-progress', (p) => {
    bruteForceLog(`Baixando: ${Math.floor(p.percent)}%`);
    sendToUI('download-progress', p.percent);
});
autoUpdater.on('update-downloaded', (info) => {
    bruteForceLog("Download concluído. Reiniciando em 5s...");
    sendToUI('update-downloaded');
    setTimeout(() => { if (app.isPackaged) autoUpdater.quitAndInstall(false, true); }, 5000);
});
autoUpdater.on('error', (err) => {
    bruteForceLog("FALHA: " + err.message, true);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });