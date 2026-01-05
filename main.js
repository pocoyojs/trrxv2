const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// 1. Configuração de Logs Profissional
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// 2. Variável Global para a Janela
let mainWindow;

/**
 * FUNÇÃO DE LOG DE FORÇA BRUTA (GIGANTE NA TELA)
 * Melhorada para garantir visibilidade e suporte a quebra de linha.
 */
function bruteForceLog(msg, isError = false) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        const bgColor = isError ? 'rgba(220, 38, 38, 0.95)' : 'rgba(10, 10, 12, 0.9)';
        const textColor = isError ? '#ffff00' : '#00ff00';
        
        const script = `
            (function() {
                let dbg = document.getElementById('trrx-debug-log');
                if(!dbg) {
                    dbg = document.createElement('div');
                    dbg.id = 'trrx-debug-log';
                    dbg.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:999999; background:${bgColor}; color:${textColor}; padding:40px; font-family:monospace; font-size:13px; overflow-y:auto; pointer-events:none; display:flex; flex-direction:column; gap:5px; border: 4px solid white;';
                    document.body.appendChild(dbg);
                    
                    const title = document.createElement('h1');
                    title.innerText = "SISTEMA DE DIAGNÓSTICO AUTO-UPDATE";
                    title.style.fontSize = "22px";
                    title.style.marginBottom = "15px";
                    dbg.appendChild(title);
                }
                const line = document.createElement('div');
                line.style.whiteSpace = 'pre-wrap';
                line.style.wordBreak = 'break-all';
                line.innerText = "[" + new Date().toLocaleTimeString() + "] " + ${JSON.stringify(msg)};
                dbg.appendChild(line);
                dbg.scrollTop = dbg.scrollHeight;
            })();
        `;
        mainWindow.webContents.executeJavaScript(script).catch(() => {});
    }
}

function sendToUI(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send(channel, data);
    }
}

// 3. Configuração do Updater (Forçada para Repositório Privado)
function setupUpdater() {
    if (app.isPackaged) {
        // CORREÇÃO CRUCIAL: Usar o objeto de configuração para forçar o canal privado
        autoUpdater.setFeedURL({
            provider: "github",
            owner: "pocoyojs",
            repo: "trrxv2",
            private: true
        });

        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.allowPrerelease = false;

        setTimeout(() => {
            bruteForceLog("Verificando atualizações via API GitHub...");
            autoUpdater.checkForUpdatesAndNotify().catch(err => {
                bruteForceLog("FALHA NA BUSCA: " + err.message, true);
                if(err.message.includes("404")) {
                    bruteForceLog("ERRO 404: O app não encontrou a release. Verifique se o GH_TOKEN foi injetado no BUILD.", true);
                }
            });
        }, 4000);
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
        bruteForceLog("App Packaged: " + app.isPackaged);
        bruteForceLog("Versão Local: " + app.getVersion());
        setupUpdater();
    });

    // Bloqueios de segurança
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (app.isPackaged) {
            const blocked = input.key === 'F12' || 
                           (input.control && input.shift && ['I', 'J', 'C'].includes(input.key)) || 
                           (input.control && ['R', 'U'].includes(input.key));
            if (blocked) event.preventDefault();
        }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// 4. Eventos do Auto-Updater
autoUpdater.on('checking-for-update', () => bruteForceLog("Conectando ao GitHub API..."));

autoUpdater.on('update-available', (info) => {
    bruteForceLog("SUCESSO: Nova versão detectada!");
    bruteForceLog("Versão encontrada: v" + info.version);
    sendToUI('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
    bruteForceLog("Sincronizado: Você já possui a versão mais recente.");
});

autoUpdater.on('download-progress', (p) => {
    bruteForceLog(`Progresso: ${Math.floor(p.percent)}% | Velocidade: ${Math.floor(p.bytesPerSecond / 1024)} KB/s`);
    sendToUI('download-progress', p.percent);
});

autoUpdater.on('update-downloaded', () => {
    bruteForceLog("Download concluído. Reiniciando em 5 segundos...", false);
    sendToUI('update-downloaded');
    setTimeout(() => { 
        if (app.isPackaged) autoUpdater.quitAndInstall(false, true); 
    }, 5000);
});

autoUpdater.on('error', (err) => {
    log.error('Erro no Updater:', err);
    bruteForceLog("ERRO NO UPDATER: " + err.message, true);
});

// Inicialização
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });