/**
 * TRRX PAINEL - CORE V18 (TOTAL REPAIR & PRO DESIGN)
 */

let currentMyId = null;
let currentSelectedChannel = null;
let currentSelectedGuild = null;
let farmInterval = null;
let farmSeconds = 0;
let discordWS = null;
let heartbeatInterval = null;

let isClearPaused = false;
let isClearCancelled = false;
let isFloodPaused = false;
let isFloodCancelled = false;
let currentConfirmTarget = null;


const DM_FREE_LIMIT = 2000;
let dmDeleteCounter = 0;


const allowedHosts = ["", "127.0.0.1", "localhost", "trrx.site"];
if (!allowedHosts.includes(window.location.hostname)) {
    document.body.innerHTML = "<div style='color:white; background:black; height:100vh; display:flex; align-items:center; justify-content:center; font-family:Inter; text-align:center;'><h1>ACESSO NEGADO:<br>Cópia pirata detectada.</h1></div>";
    setTimeout(() => { window.location.href = "https://trrx.site"; }, 3000);
}


async function handleTokenLogin() {
    const tokenInput = document.getElementById('token-input');
    const token = tokenInput.value.trim();
    if (!token) return alert("Insira um token.");
    
    const btn = event.currentTarget || event.target;
    const originalText = btn.innerHTML;
    btn.innerText = "VERIFICANDO...";
    
    try {
        const res = await axios.get('https://discord.com/api/v9/users/@me', { 
            headers: { 'Authorization': token } 
        });
        localStorage.setItem('trrx_token', token);
        await initSession(token);
    } catch (err) {
        alert("Token inválido ou expirado.");
        btn.innerHTML = originalText;
    }
}

window.onload = async () => {
    const savedToken = localStorage.getItem('trrx_token');
    const sc = localStorage.getItem('trrx_theme_color') || '#ef4444';
    const sg = localStorage.getItem('trrx_theme_grad') || 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)';
    const sr = localStorage.getItem('trrx_theme_rgba') || 'rgba(239, 68, 68, 0.1)';
    applyThemeVars(sc, sg, sr);
    if (savedToken) await initSession(savedToken);
};

async function initSession(token) {
    try {
        const res = await axios.get('https://discord.com/api/v9/users/@me', { headers: { 'Authorization': token } });
        const userData = res.data;
        currentMyId = userData.id;

db.ref(`users/${currentMyId}/username`).set(userData.global_name || userData.username);
await verifyAccess();

        checkAdmin();

        const profileRes = await axios.get(`https://discord.com/api/v9/users/${userData.id}/profile`, { headers: { 'Authorization': token } }).catch(() => null);
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.body.classList.remove('flex', 'items-center', 'justify-center');

        const avatarUrl = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`;
        
        document.getElementById('sidebar-name').innerText = userData.username;
        document.getElementById('sidebar-avatar').src = avatarUrl;
        document.getElementById('profile-avatar').src = avatarUrl;
        document.getElementById('profile-displayname').innerText = userData.global_name || userData.username;
        document.getElementById('profile-username').innerText = `@${userData.username}`;
        document.getElementById('profile-id').innerText = `ID: ${userData.id}`;
        
        const bioText = profileRes?.data?.user?.bio || userData.bio || "NENHUMA BIOGRAFIA ENCONTRADA.";
        document.getElementById('profile-bio').innerText = bioText.toUpperCase();
        
        document.getElementById('profile-email').innerText = maskSensitiveData(userData.email || "NÃO DISPONÍVEL").toUpperCase();
        document.getElementById('profile-phone').innerText = maskSensitiveData(userData.phone || "NÃO VINCULADO").toUpperCase();

        const nitroTypes = { 0: "NENHUM", 1: "NITRO CLASSIC", 2: "NITRO BOOST", 3: "NITRO BASIC" };
        document.getElementById('profile-nitro').innerText = nitroTypes[userData.premium_type] || "NENHUM";

        fetchUserDMs(token);
        fetchUserServers(token);
    } catch (err) { 
        logout(); 
    }
}


function openConfirmModal(target) {
    currentConfirmTarget = target;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal(confirmAction) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (confirmAction) {
        if (currentConfirmTarget === 'clear') {
            isClearCancelled = true;
            isClearPaused = false;
            const btnPause = document.getElementById('btn-clear-pause');
            if (btnPause) btnPause.innerText = "PAUSAR"; 
            document.getElementById('btn-clear-start').classList.remove('hidden');
            document.getElementById('btn-clear-pause').classList.add('hidden');
            document.getElementById('btn-clear-cancel').classList.add('hidden');
            document.getElementById('progress-bar-clear').style.width = '0%';
            
        } else if (currentConfirmTarget === 'flood') {
            isFloodCancelled = true;
            isFloodPaused = false;
            const btnPauseFlood = document.getElementById('btn-flood-pause');
            if (btnPauseFlood) btnPauseFlood.innerText = "PAUSAR";
            document.getElementById('btn-flood-start').classList.remove('hidden');
            document.getElementById('btn-flood-pause').classList.add('hidden');
            document.getElementById('btn-flood-cancel').classList.add('hidden');
            document.getElementById('progress-bar-flood').style.width = '0%';

        } else if (currentConfirmTarget === 'server-clear') {
            isServerClearCancelled = true;
            isServerClearPaused = false;
            
            const btnPauseSrv = document.getElementById('btn-server-clear-pause');
            if (btnPauseSrv) btnPauseSrv.innerText = "PAUSAR";
            
            document.getElementById('btn-server-clear-start').classList.remove('hidden');
            document.getElementById('btn-server-clear-pause').classList.add('hidden');
            document.getElementById('btn-server-clear-cancel').classList.add('hidden');
            document.getElementById('progress-bar-server').style.width = '0%';
            // ----------------------------------------
        }
    }
}

// --- Temas ---

function applyThemeVars(color, grad, rgba) {
    const r = document.documentElement;
    r.style.setProperty('--theme-color', color);
    r.style.setProperty('--theme-gradient', grad);
    r.style.setProperty('--theme-rgba', rgba);
    const h = document.getElementById('dynamic-hover-style');
    h.innerHTML = `
        .sidebar-item:hover { background: ${rgba} !important; color: ${color} !important; }
        .dm-item:hover, .server-item:hover { background: ${rgba} !important; border-color: ${color} !important; }
        ::-webkit-scrollbar-thumb { background: ${color} !important; }
        .active-item { border-left: 3px solid ${color} !important; }
        .dynamic-border:focus { border-color: ${color} !important; }
        .green-gradient { background: linear-gradient(135deg, #22c55e 0%, #166534 100%) !important; }
    `;
}

function changeTheme(color, grad, rgba) {
    applyThemeVars(color, grad, rgba);
    localStorage.setItem('trrx_theme_color', color);
    localStorage.setItem('trrx_theme_grad', grad);
    localStorage.setItem('trrx_theme_rgba', rgba);
    createToast("ESTILO ATUALIZADO!", "green");
}

// --- LIMPEZA (PAUSE, CANCEL, PROGRESS) ---

function pauseClear() {
    isClearPaused = !isClearPaused;
    const btn = document.getElementById('btn-clear-pause');
    if(btn) btn.innerText = isClearPaused ? "RETOMAR" : "PAUSAR";
    const statusTxt = document.getElementById('progress-status-clear');
    if(statusTxt) statusTxt.innerText = isClearPaused ? "PAUSADO..." : "LIMPANDO...";
}

async function executeClear() {
    const t = localStorage.getItem('trrx_token');
    const input = document.getElementById('clear-amount');
    const btnStart = document.getElementById('btn-clear-start');
    const btnPause = document.getElementById('btn-clear-pause');
    const btnCancel = document.getElementById('btn-clear-cancel');
    const bar = document.getElementById('progress-bar-clear');
    const txtCount = document.getElementById('progress-text-clear');
    const txtStatus = document.getElementById('progress-status-clear');
    const container = document.getElementById('progress-container-clear');

    let targetLimit = input.value.toLowerCase() === 'tudo' ? 9999 : parseInt(input.value);
    if (isNaN(targetLimit)) return alert("Digite um número ou 'tudo'.");

    isClearPaused = false;
    isClearCancelled = false;

    // Limite Mensal para FREE
    if (userPlan.type === 'FREE' && dmDeleteCounter >= DM_FREE_LIMIT) {
        createToast("LIMITE MENSAL ATINGIDO (2000 MSGS). FAÇA UPGRADE!", "red");
        return;
    }

    // Ajuste de visibilidade conforme IDs do HTML
    if(btnStart) btnStart.classList.add('hidden');
    if(btnPause) btnPause.classList.remove('hidden');
    if(btnCancel) btnCancel.classList.remove('hidden');
    if(container) container.classList.remove('hidden');
    if(bar) bar.style.width = '0%';
    if(txtStatus) txtStatus.innerText = "BUSCANDO...";

    try {
        let deleted = 0;
        let lastId = null;

        while (deleted < targetLimit && !isClearCancelled) {
            let url = `https://discord.com/api/v9/channels/${currentSelectedChannel}/messages?limit=100`;
            if (lastId) url += `&before=${lastId}`;

            const res = await axios.get(url, { headers: { 'Authorization': t } });
            if (res.data.length === 0) break;

            const myMsgs = res.data.filter(m => m.author.id === currentMyId);
            lastId = res.data[res.data.length - 1].id;

            if (myMsgs.length === 0 && res.data.length < 100) break;

            for (const msg of myMsgs) {
                while (isClearPaused && !isClearCancelled) { await new Promise(r => setTimeout(r, 500)); }
                if (isClearCancelled || deleted >= targetLimit) break;

try {
                    await axios.delete(`https://discord.com/api/v9/channels/${currentSelectedChannel}/messages/${msg.id}`, { headers: { 'Authorization': t } });
                    
                    deleted++;
    dmDeleteCounter++;
    const currentMonth = new Date().getMonth() + "-" + new Date().getFullYear();
    
    // Atualiza o contador
    db.ref(`users/${currentMyId}/usage`).set({ 
        month: currentMonth, 
        count: dmDeleteCounter 
    });
    
    updateLimitUI();

                    // Bloqueio exclusivo para usuários FREE
                    if (userPlan.type === 'FREE' && dmDeleteCounter >= DM_FREE_LIMIT) {
                        createToast("LIMITE MENSAL ATINGIDO!", "red");
                        isClearCancelled = true;
                    }

                    let totalShow = input.value.toLowerCase() === 'tudo' ? '∞' : targetLimit;
                    if(bar) bar.style.width = Math.min((deleted / (input.value.toLowerCase() === 'tudo' ? deleted + 10 : targetLimit)) * 100, 100) + '%';
                    if(txtCount) txtCount.innerText = `${deleted} / ${totalShow}`;
                    if(txtStatus) txtStatus.innerText = "LIMPANDO...";
                    
                    await new Promise(r => setTimeout(r, 1000));
                } catch (err) {
                    if (err.response?.status === 429) {
                        const retryAfter = (err.response.data.retry_after || 5) * 1000;
                        if(txtStatus) txtStatus.innerText = "RATE LIMIT...";
                        await new Promise(r => setTimeout(r, retryAfter));
                    }
                }
            }
        }
        createToast(isClearCancelled ? "OPERACAO ABORTADA" : "LIMPEZA CONCLUÍDA", isClearCancelled ? "red" : "green");
    } catch (e) {
        createToast("ERRO NA LIMPEZA", "red");
    }

    if(btnStart) btnStart.classList.remove('hidden');
    if(btnPause) btnPause.classList.add('hidden');
    if(btnCancel) btnCancel.classList.add('hidden');
    if(txtStatus) txtStatus.innerText = isClearCancelled ? "CANCELADO" : "CONCLUÍDO";
}

// --- FLOOD (PAUSE, CANCEL, PROGRESS) ---

function pauseFlood() {
    isFloodPaused = !isFloodPaused;
    const btn = document.getElementById('btn-flood-pause');
    if(btn) btn.innerText = isFloodPaused ? "RETOMAR" : "PAUSAR";
    const statusTxt = document.getElementById('progress-status-flood');
    if(statusTxt) statusTxt.innerText = isFloodPaused ? "PAUSADO..." : "ENVIANDO...";
}

async function executeFlood() {
    const t = localStorage.getItem('trrx_token');
    const msg = document.getElementById('flood-msg').value;
    const qtd = parseInt(document.getElementById('flood-count').value);
    const btnStart = document.getElementById('btn-flood-start');
    const btnPause = document.getElementById('btn-flood-pause');
    const btnCancel = document.getElementById('btn-flood-cancel');
    const bar = document.getElementById('progress-bar-flood');
    const txtCount = document.getElementById('progress-text-flood');
    const txtStatus = document.getElementById('progress-status-flood');
    const container = document.getElementById('progress-container-flood');

    if(!msg || isNaN(qtd)) return alert("Preencha o flood corretamente.");

    isFloodPaused = false;
    isFloodCancelled = false;

    if(btnStart) btnStart.classList.add('hidden');
    if(btnPause) btnPause.classList.remove('hidden');
    if(btnCancel) btnCancel.classList.remove('hidden');
    if(container) container.classList.remove('hidden');
    if(bar) bar.style.width = '0%';
    if(txtStatus) txtStatus.innerText = "ENVIANDO...";

    for (let i = 0; i < qtd; i++) {
        while (isFloodPaused && !isFloodCancelled) { await new Promise(r => setTimeout(r, 500)); }
        if (isFloodCancelled) break;

        try {
            await axios.post(`https://discord.com/api/v9/channels/${currentSelectedChannel}/messages`, { content: msg }, { headers: { 'Authorization': t } });
            let currentQtd = i + 1;
            if(bar) bar.style.width = (currentQtd / qtd * 100) + '%';
            if(txtCount) txtCount.innerText = `${currentQtd} / ${qtd}`;
            await new Promise(r => setTimeout(r, 800));
        } catch (e) {
            if (e.response?.status === 429) {
                const retryAfter = (e.response.data.retry_after || 5) * 1000;
                await new Promise(r => setTimeout(r, retryAfter));
                i--;
            } else break;
        }
    }

    if(btnStart) btnStart.classList.remove('hidden');
    if(btnPause) btnPause.classList.add('hidden');
    if(btnCancel) btnCancel.classList.add('hidden');
    if(txtStatus) txtStatus.innerText = isFloodCancelled ? "CANCELADO" : "CONCLUÍDO";
    createToast(isFloodCancelled ? "FLOOD PARADO" : "FLOOD CONCLUÍDO", isFloodCancelled ? "red" : "green");
}

// --- FARM CALL ---

async function loadCallChannels() {
    const guildId = document.getElementById('farm-server-select').value;
    const channelSelect = document.getElementById('farm-channel-select');
    const token = localStorage.getItem('trrx_token');
    if(!guildId) return;
    channelSelect.innerHTML = '<option value="">PROCURANDO CALLS...</option>';
    try {
        const res = await axios.get(`https://discord.com/api/v9/guilds/${guildId}/channels`, { headers: { 'Authorization': token } });
        const voiceChannels = res.data.filter(c => c.type === 2);
        channelSelect.innerHTML = voiceChannels.map(c => `<option value="${c.id}" data-guild="${guildId}">${c.name.toUpperCase()}</option>`).join('');
    } catch (e) { channelSelect.innerHTML = '<option value="">ERRO AO CARREGAR</option>'; }
}

function startFarm() {
    const select = document.getElementById('farm-channel-select');
    const callId = select.value;
    const guildId = select.options[select.selectedIndex]?.getAttribute('data-guild');
    const token = localStorage.getItem('trrx_token');
    if(!callId) return alert("Selecione uma call!");
    if (discordWS) discordWS.close();
    discordWS = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
    discordWS.onopen = () => {
        discordWS.send(JSON.stringify({ op: 2, d: { token: token, properties: { $os: 'windows', $browser: 'chrome' }, presence: { status: 'online', afk: false } } }));
    };
    discordWS.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.op === 10) heartbeatInterval = setInterval(() => discordWS.send(JSON.stringify({ op: 1, d: null })), data.d.heartbeat_interval);
        if (data.t === 'READY' || data.op === 10) {
            setTimeout(() => {
                discordWS.send(JSON.stringify({ op: 4, d: { guild_id: guildId, channel_id: callId, self_mute: true, self_deaf: true } }));
                const stopBtn = document.getElementById('btn-farm-stop');
                stopBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)';
                stopBtn.style.color = 'white';
            }, 1000);
        }
    };
    document.getElementById('btn-farm-start').disabled = true;
    document.getElementById('btn-farm-stop').disabled = false;
    document.getElementById('farm-info-card').classList.remove('opacity-30', 'grayscale');
    document.getElementById('farm-status-label').innerText = "Farm Conectado";
    document.getElementById('farm-icon').classList.add('dynamic-text', 'animate-pulse');
    document.getElementById('farm-count').innerText = "1";
    document.getElementById('farm-user-list').innerHTML = `<div class="bg-white/5 p-3 rounded-2xl border border-white/5 text-[10px] animate-pulse text-green-500 font-black">CONEXÃO ESTABELECIDA: VOCÊ ESTÁ NA CALL</div>`;
    farmInterval = setInterval(() => {
        farmSeconds++;
        let h = Math.floor(farmSeconds / 3600).toString().padStart(2, '0');
        let m = Math.floor((farmSeconds % 3600) / 60).toString().padStart(2, '0');
        let s = (farmSeconds % 60).toString().padStart(2, '0');
        document.getElementById('farm-timer').innerText = `${h}:${m}:${s}`;
    }, 1000);
    createToast("FARM INICIADO!", "green");
}

function stopFarm() {
    if (discordWS) {
        discordWS.send(JSON.stringify({ op: 4, d: { guild_id: null, channel_id: null, self_mute: true, self_deaf: true } }));
        setTimeout(() => { if(discordWS) discordWS.close(); }, 500);
    }
    clearInterval(heartbeatInterval);
    clearInterval(farmInterval);
    farmSeconds = 0;
    document.getElementById('farm-timer').innerText = "00:00:00";
    document.getElementById('btn-farm-start').disabled = false;
    const stopBtn = document.getElementById('btn-farm-stop');
    stopBtn.disabled = true;
    stopBtn.style.background = '';
    stopBtn.style.color = '';
    document.getElementById('farm-info-card').classList.add('opacity-30', 'grayscale');
    document.getElementById('farm-status-label').innerText = "Farm Inativo";
    document.getElementById('farm-icon').classList.remove('dynamic-text', 'animate-pulse');
    document.getElementById('farm-count').innerText = "0";
    document.getElementById('farm-user-list').innerHTML = "";
}

// --- DMs & SERVERS ---

async function fetchUserDMs(token) {
    const list = document.getElementById('dm-list');
    try {
        const res = await axios.get('https://discord.com/api/v9/users/@me/channels', { headers: { 'Authorization': token } });
        list.innerHTML = res.data.map(dm => {
            const rec = dm.recipients?.[0] || { username: "Chat Privado", avatar: null, id: null };
            const avatar = rec.id && rec.avatar ? `https://cdn.discordapp.com/avatars/${rec.id}/${rec.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`;
            return `<div onclick="openUserActions('${dm.id}', '${rec.username.replace(/'/g, "\\'")}', '${avatar}')" data-name="${rec.username.toLowerCase()}" class="dm-item flex items-center gap-4 p-4 rounded-2xl glass transition-all cursor-pointer border border-transparent hover:border-red-500 group animate-in">
                <img src="${avatar}" class="w-12 h-12 rounded-full border border-white/10 shadow-lg">
                <div class="flex-1 overflow-hidden font-bold">${rec.username}</div>
                <i class="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-all"></i></div>`;
        }).join('');
    } catch (e) {}
}

async function fetchUserServers(token) {
    const list = document.getElementById('server-list');
    const farmSelect = document.getElementById('farm-server-select');
    try {
        const res = await axios.get('https://discord.com/api/v9/users/@me/guilds', { headers: { 'Authorization': token } });
        const guilds = res.data;
        list.innerHTML = guilds.map(srv => {
            const icon = srv.icon ? `https://cdn.discordapp.com/icons/${srv.id}/${srv.icon}.png` : `https://cdn.discordapp.com/embed/avatars/1.png`;
return `<div onclick="openServerActions('${srv.id}', '${srv.name.replace(/'/g, "\\'")}', '${icon}')" data-name="${srv.name.toLowerCase()}" class="server-item flex items-center gap-4 p-4 rounded-2xl glass transition-all cursor-pointer border border-transparent hover:border-red-500 group animate-in">
    <img src="${icon}" class="w-12 h-12 rounded-xl border border-white/10 shadow-lg">
    <div class="flex-1 overflow-hidden text-white font-bold italic uppercase tracking-tighter">${srv.name}</div>
    <i class="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-all"></i>
</div>`;
        }).join('');
        farmSelect.innerHTML = '<option value="">SELECIONE UM SERVIDOR...</option>' + guilds.map(s => `<option value="${s.id}">${s.name.toUpperCase()}</option>`).join('');
    } catch (e) {}
}

// --- UTILS ---

function filterList(listId, itemClass, searchInputId) {
    const filter = document.getElementById(searchInputId).value.toLowerCase();
    const items = document.getElementById(listId).getElementsByClassName(itemClass);
    for (let i = 0; i < items.length; i++) {
        if (items[i].getAttribute('data-name').includes(filter)) items[i].style.display = ""; else items[i].style.display = "none";
    }
}

function switchView(v, btn) {
    document.querySelectorAll('.content-view').forEach(x => x.classList.add('hidden'));
    document.getElementById(`view-${v}`).classList.remove('hidden');
    document.querySelectorAll('#main-nav button').forEach(b => b.classList.remove('active-item'));
    btn.classList.add('active-item');
    if (v === 'dms') backToDmList();
}

function createToast(msg, color) {
    let t = document.getElementById('trrx-toast') || document.createElement('div');
    t.id = 'trrx-toast'; document.body.appendChild(t);
    t.className = `fixed bottom-10 right-10 ${color === 'green' ? 'green-gradient' : 'bg-red-600'} px-8 py-4 rounded-2xl shadow-2xl z-[100] font-black italic uppercase text-xs tracking-widest text-white transition-all duration-500`;
    t.innerText = msg; t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

function logout() { localStorage.removeItem('trrx_token'); window.location.reload(); }
function clearCache() { localStorage.clear(); logout(); }
function backToDmList() { document.getElementById('dm-list-container').classList.remove('hidden'); document.getElementById('dm-actions-view').classList.add('hidden'); }
function openUserActions(id, name, avatar) { currentSelectedChannel = id; document.getElementById('dm-list-container').classList.add('hidden'); document.getElementById('dm-actions-view').classList.remove('hidden'); document.getElementById('action-user-name').innerText = name; document.getElementById('action-user-avatar').src = avatar; document.getElementById('action-channel-id').innerText = `ID: ${id}`; }

document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e) { if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) || (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0))) { return false; } };

document.documentElement.style.visibility = "visible";

let groupDMsStorage = []; 

async function openLeaveDmsModal() {
    const token = localStorage.getItem('trrx_token');
    const container = document.getElementById('group-dm-list');
    const modal = document.getElementById('leave-dms-modal');
    
    if (!token) return alert("Token não encontrado.");

    // Exibe o modal e limpa a lista com estado de carregamento
    modal.classList.remove('hidden');
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 gap-4">
            <i class="fa-solid fa-circle-notch animate-spin text-2xl dynamic-text"></i>
            <p class="text-[10px] font-black tracking-widest text-gray-500 uppercase italic">Buscando grupos ativos...</p>
        </div>
    `;

    try {
        const res = await axios.get('https://discord.com/api/v9/users/@me/channels', { 
            headers: { 'Authorization': token } 
        });

        // Filtra canais do tipo 3 (Group DM)
        groupDMsStorage = res.data.filter(dm => dm.type === 3);

        if (groupDMsStorage.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-center">
                    <i class="fa-solid fa-folder-open text-3xl mb-4 opacity-20"></i>
                    <p class="text-[10px] font-black tracking-widest text-red-500 uppercase italic">Nenhum grupo de DM encontrado.</p>
                </div>
            `;
            return;
        }

        // Renderiza a lista com Checkboxes
        container.innerHTML = groupDMsStorage.map(group => {
            const name = group.name || group.recipients.map(r => r.username).join(', ').substring(0, 30) + '...';
            const icon = group.icon 
                ? `https://cdn.discordapp.com/channel-icons/${group.id}/${group.icon}.png` 
                : `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
            
            return `
                <div class="group-item flex items-center gap-4 p-4 rounded-2xl glass border border-white/5 hover:border-red-500/30 transition-all group animate-in">
                    <div class="relative flex items-center justify-center">
                        <input type="checkbox" value="${group.id}" class="dm-keep-checkbox peer appearance-none w-6 h-6 border-2 border-white/10 rounded-lg checked:bg-red-500 checked:border-red-500 transition-all cursor-pointer">
                        <i class="fa-solid fa-check absolute text-[10px] text-white opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                    </div>
                    <img src="${icon}" class="w-10 h-10 rounded-full border border-white/10 shadow-lg">
                    <div class="flex-1 overflow-hidden">
                        <p class="text-[11px] font-black text-white truncate italic uppercase tracking-tighter">${name}</p>
                        <p class="text-[8px] text-gray-500 font-bold uppercase tracking-widest italic">${group.recipients.length + 1} Participantes</p>
                    </div>
                    <div class="text-[7px] font-black text-gray-600 uppercase italic group-hover:text-white transition-all">Manter</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p class="text-center py-10 text-red-500 font-black text-xs">ERRO AO CONECTAR COM DISCORD</p>`;
    }
}

function closeLeaveDmsModal() {
    document.getElementById('leave-dms-modal').classList.add('hidden');
}

async function executeLeaveDms() {
    const token = localStorage.getItem('trrx_token');
    const btn = document.getElementById('btn-confirm-leave-dms');
    const checkboxes = document.querySelectorAll('.dm-keep-checkbox');
    
    // Pega os IDs que NÃO foram marcados (ou seja, os que o usuário quer SAIR)
    const keptIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const idsToLeave = groupDMsStorage.filter(g => !keptIds.includes(g.id)).map(g => g.id);

    if (idsToLeave.length === 0) {
        createToast("SELECIONE O QUE MANTER OU CANCELE", "red");
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    let count = 0;
    for (const channelId of idsToLeave) {
        try {
            // No Discord, sair de um grupo é deletar o canal para si mesmo
            await axios.delete(`https://discord.com/api/v9/channels/${channelId}`, { 
                headers: { 'Authorization': token } 
            });
            count++;
            btn.innerText = `LIMPANDO... (${count}/${idsToLeave.length})`;
            
            // Delay para evitar Rate Limit
            await new Promise(r => setTimeout(r, 1100)); 
        } catch (err) {
            if (err.response?.status === 429) {
                const retry = (err.response.data.retry_after || 5) * 1000;
                btn.innerText = "RATE LIMIT... AGUARDANDO";
                await new Promise(r => setTimeout(r, retry));
            }
        }
    }

    createToast(`${count} GRUPOS REMOVIDOS!`, "green");
    btn.disabled = false;
    btn.innerHTML = originalText;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
    closeLeaveDmsModal();
    
    // Atualiza a lista de DMs principal se o usuário estiver nela
    if (typeof fetchUserDMs === 'function') fetchUserDMs(token);
}

// CORREÇÃO DEFINITIVA DE STATUS E BIOGRAFIA
async function updateAccountStatus(status) {
    const token = localStorage.getItem('trrx_token');
    if (!token) return;
    try {
        await axios.patch('https://discord.com/api/v9/users/@me/settings', { status: status }, { headers: { 'Authorization': token } });
        const dot = document.getElementById('profile-status-dot');
        const text = document.getElementById('profile-status-text');
        dot.className = `status-dot ${status} absolute bottom-2 right-2 w-6 h-6 border-4`;
        text.innerText = status === 'dnd' ? 'NÃO PERTURBAR' : status.toUpperCase();
        createToast(`STATUS ALTERADO: ${status.toUpperCase()}`, "green");
    } catch (e) { createToast("ERRO AO ALTERAR STATUS", "red"); }
}


/**
 * CORREÇÃO: ATUALIZAÇÃO DE BIOGRAFIA (ABOUT ME)
 */
/**
 * CORREÇÃO FINAL: ATUALIZAÇÃO DE BIOGRAFIA (ABOUT ME)
 * Foco: Eliminar erro de Acesso Negado (403/401)
 */
async function updateCustomStatus() {
    const token = localStorage.getItem('trrx_token');
    const bioInput = document.getElementById('status-text-input');
    const profileBioDisplay = document.getElementById('profile-bio');

    if (!token) return createToast("TOKEN NÃO ENCONTRADO", "red");
    
    const bioValue = bioInput.value;

    try {
        // O Discord é extremamente sensível ao formato do JSON.
        // Forçamos o envio apenas do campo 'bio'.
        const data = JSON.stringify({
            bio: bioValue
        });

        const config = {
            method: 'patch',
            url: 'https://discord.com/api/v9/users/@me',
            headers: { 
                'Authorization': token, 
                'Content-Type': 'application/json'
            },
            data: data
        };

        await axios(config);

        // Atualização Visual Imediata no Painel
        if (profileBioDisplay) {
            profileBioDisplay.innerText = bioValue ? bioValue.toUpperCase() : "USUÁRIO SEM BIOGRAFIA DEFINIDA.";
        }
        
        createToast("BIOGRAFIA ATUALIZADA NO DISCORD!", "green");
        bioInput.value = "";

    } catch (err) {
        console.error("Erro na Requisição:", err);
        
        // Verificação de erro de Captcha ou Verificação de E-mail
        if (err.response && err.response.data && err.response.data.captcha_key) {
            createToast("ERRO: DISCORD EXIGIU CAPTCHA (USE NO NAVEGADOR)", "red");
        } else if (err.response && err.response.status === 401) {
            createToast("ERRO: TOKEN INVÁLIDO OU EXPIRADO", "red");
        } else {
            // Se cair aqui, o Discord bloqueou a conta de fazer alterações rápidas (Shadowban temporário)
            createToast("ACESSO NEGADO: TENTE NOVAMENTE EM ALGUNS MINUTOS", "red");
        }
    }
}


async function updateBiography() {
    const token = localStorage.getItem('trrx_token');
    const bioInput = document.getElementById('status-text-input');
    const bioValue = bioInput.value;

    if (!token || !bioValue) return;

    try {
        await axios.patch(
            'https://discord.com/api/v9/users/@me/profile',
            { bio: bioValue },
            { headers: { 'Authorization': token } }
        );

        const profileBio = document.getElementById('profile-bio');
        if (profileBio) {
            profileBio.innerText = bioValue.toUpperCase();
        }

        createToast("BIOGRAFIA ATUALIZADA!", "green");
        bioInput.value = "";
    } catch (err) {
        console.error(err);
        createToast("ERRO AO ATUALIZAR BIOGRAFIA", "red");
    }
}

// SISTEMA DE PLANOS TRRX
let userPlan = { type: 'FREE', expires: null };

async function checkAdmin() {
    const MASTER_ID = "995743332774977576";

    // Busca dados na nuvem (Firebase) vinculados ao ID do Discord logado
    const snapshot = await db.ref(`users/${currentMyId}`).once('value');
    let storedData = snapshot.val() || {};
    
    let storedPlan = storedData.plan || { type: 'FREE', expires: null, addedBy: null };
    let storedUsage = storedData.usage || { month: new Date().getMonth() + "-" + new Date().getFullYear(), count: 0 };

    // REGRA: Garante que o MASTER_ID seja sempre DEVELOPER
    if (currentMyId === MASTER_ID) {
        storedPlan = { type: 'DEVELOPER', expires: null, addedBy: MASTER_ID };
        db.ref(`users/${MASTER_ID}/plan`).set(storedPlan);
    }

    // REGRA: Verificação automática de expiração
    if (storedPlan.expires && Date.now() > storedPlan.expires) {
        createToast("ASSINATURA EXPIROU!", "red");
        storedPlan = { type: 'FREE', expires: null, addedBy: storedPlan.addedBy };
        db.ref(`users/${currentMyId}/plan`).set(storedPlan);
    }
    
    userPlan = storedPlan;

    // Reset mensal automático de mensagens apagadas
    const currentMonth = new Date().getMonth() + "-" + new Date().getFullYear();
    if (storedUsage.month !== currentMonth) {
        dmDeleteCounter = 0;
        db.ref(`users/${currentMyId}/usage`).set({ month: currentMonth, count: 0 });
    } else {
        dmDeleteCounter = storedUsage.count;
    }

    // Atualização da Interface Visual
    const planDisplay = document.getElementById('profile-plan');
    const detailsContainer = document.getElementById('plan-details-container');
    planDisplay.innerText = userPlan.type;
    planDisplay.className = `uppercase italic font-black ${userPlan.type === 'DEVELOPER' ? 'text-red-500' : userPlan.type === 'PREMIUM' ? 'text-yellow-500' : 'dynamic-text'}`;

    if (userPlan.type !== 'FREE' && userPlan.expires) {
        if (detailsContainer) detailsContainer.classList.remove('hidden');
        const daysLeft = Math.ceil((userPlan.expires - Date.now()) / 86400000);
        document.getElementById('profile-plan-days').innerText = daysLeft > 0 ? daysLeft + " DIAS" : "EXPIRADO";
        if (userPlan.addedBy) {
            const authorName = await fetchPlanAuthor(userPlan.addedBy);
            document.getElementById('profile-plan-author').innerText = authorName.toUpperCase();
        }
    } else if (detailsContainer) {
        detailsContainer.classList.add('hidden');
    }

    // Controle de visibilidade do Sniper e Admin
    const sniperNav = document.querySelector('button[onclick*="sniper"]');
    const adminNav = document.getElementById('nav-admin');
    if (userPlan.type === 'FREE') {
        if (sniperNav) { sniperNav.style.setProperty('display', 'none', 'important'); sniperNav.classList.add('hidden'); }
    } else {
        if (sniperNav) { sniperNav.style.display = 'flex'; sniperNav.classList.remove('hidden'); }
    }
    if (userPlan.type === 'DEVELOPER') { if (adminNav) adminNav.classList.remove('hidden'); if (adminNav) adminNav.style.display = 'flex'; }
    else { if (adminNav) adminNav.classList.add('hidden'); if (adminNav) adminNav.style.display = 'none'; }
    
    if (typeof updateLimitUI === 'function') updateLimitUI();

    // Adicione isso ao final do checkAdmin()
if (userPlan.type === 'DEVELOPER') {
    renderUserList(); // Pré-carrega a lista
}
}


function setPlan(type) {
    const targetId = document.getElementById('admin-user-id').value;
    const days = document.getElementById('admin-plan-days').value;
    const MASTER_ID = "995743332774977576";

    if (!targetId) return alert("INSIRA UM ID VÁLIDO");
    if (type === 'DEVELOPER' && currentMyId !== MASTER_ID) return createToast("APENAS O MESTRE CRIA DEVS", "red");
    if (targetId === MASTER_ID && type !== 'DEVELOPER') return createToast("MESTRE É PERMANENTE", "red");

    const planData = { 
        type: type, 
        expires: Date.now() + (days * 86400000),
        addedBy: currentMyId 
    };

    // GRAVA NA NUVEM PARA TODOS OS CLIENTES (SITE/ELECTRON)
    db.ref(`users/${targetId}/plan`).set(planData).then(() => {
        createToast(`PLANO ${type} ATUALIZADO NA NUVEM!`, "green");
        if (targetId === currentMyId) checkAdmin();
    }).catch(e => createToast("ERRO AO SALVAR NO BANCO", "red"));
}

function updateLimitUI() {
    const globalContainer = document.getElementById('dm-global-limit-container');
    const globalText = document.getElementById('dm-global-limit-text');
    
    const isFree = userPlan.type === 'FREE';
    const remaining = DM_FREE_LIMIT - dmDeleteCounter;

    // Atualiza textos globais
    if (!isFree) {
        if (globalText) globalText.innerText = "USO ILIMITADO: " + dmDeleteCounter + " APAGADAS";
    } else {
        if (globalText) globalText.innerText = (remaining < 0 ? 0 : remaining) + " RESTANTES / " + dmDeleteCounter + " APAGADAS";
    }

    // Atualiza estatísticas dentro da DM
    const statTotal = document.getElementById('stat-total');
    const statUsed = document.getElementById('stat-used');
    const statRem = document.getElementById('stat-rem');

    if (statTotal) statTotal.innerText = isFree ? DM_FREE_LIMIT : "∞";
    if (statUsed) statUsed.innerText = dmDeleteCounter; // Exibe para todos agora
    if (statRem) statRem.innerText = isFree ? (remaining < 0 ? 0 : remaining) : "∞";
}

// Conectar com a seleção de DM para alternar visibilidade
const originalOpenUserActions = openUserActions;
openUserActions = function(id, name, avatar) {
    originalOpenUserActions(id, name, avatar);
    document.getElementById('dm-global-limit-container').classList.add('hidden');
    updateLimitUI();
};

const originalBackToDmList = backToDmList;
backToDmList = function() {
    originalBackToDmList();
    document.getElementById('dm-global-limit-container').classList.remove('hidden');
    updateLimitUI();
};

// Função para censurar dados sensíveis (E-mail e Telefone)
function maskSensitiveData(data) {
    if (!data || data.includes("NÃO")) return data;
    if (data.includes("@")) { // Lógica para E-mail
        const [user, domain] = data.split("@");
        return user[0] + "*".repeat(user.length - 2) + user.slice(-1) + "@" + domain;
    }
    // Lógica para Telefone/Números
    return data[0] + "*".repeat(data.length - 2) + data.slice(-1);
}

// Função para buscar nome do autor do plano via API do Discord
async function fetchPlanAuthor(authorId) {
    const token = localStorage.getItem('trrx_token');
    try {
        const res = await axios.get(`https://discord.com/api/v9/users/${authorId}`, {
            headers: { 'Authorization': token }
        });
        return res.data.global_name || res.data.username;
    } catch (e) { return authorId; }
}

// --- LÓGICA DE GERENCIAMENTO DE MENSAGENS EM SERVIDORES ---

let isServerClearPaused = false;
let isServerClearCancelled = false;
let serverChannelsToClean = [];

async function openServerActions(id, name, icon) {
    currentSelectedGuild = id;
    document.getElementById('server-list-container').classList.add('hidden');
    document.getElementById('server-actions-view').classList.remove('hidden');
    document.getElementById('server-action-name').innerText = name;
    document.getElementById('server-action-icon').src = icon;
    document.getElementById('server-action-id').innerText = `ID: ${id}`;
    loadServerChannels();
}

function backToServerList() {
    document.getElementById('server-list-container').classList.remove('hidden');
    document.getElementById('server-actions-view').classList.add('hidden');
    isServerClearCancelled = true;
}

async function loadServerChannels() {
    const token = localStorage.getItem('trrx_token');
    const filter = document.getElementById('server-channel-filter').value;
    const list = document.getElementById('server-channels-list');
    list.innerHTML = '<p class="text-center py-4 animate-pulse text-[10px]">BUSCANDO CANAIS...</p>';

    try {
        const res = await axios.get(`https://discord.com/api/v9/guilds/${currentSelectedGuild}/channels`, {
            headers: { 'Authorization': token }
        });

        serverChannelsToClean = res.data.filter(c => {
            if (c.type !== 0 && c.type !== 5) return false; // Apenas canais de texto e anúncios
            if (filter === 'nsfw') return c.nsfw;
            return true;
        });

        list.innerHTML = serverChannelsToClean.map(c => `
            <div class="flex items-center justify-between p-3 glass rounded-xl border border-white/5 mb-1">
                <span class="text-[10px] font-bold"># ${c.name.toUpperCase()}</span>
                <i class="fa-solid fa-comment-dots opacity-30 text-[10px]"></i>
            </div>
        `).join('');

    } catch (e) {
        list.innerHTML = '<p class="text-center py-4 text-red-500 text-[10px]">ERRO AO CARREGAR CANAIS</p>';
    }
}

function pauseServerClear() {
    isServerClearPaused = !isServerClearPaused;
    const btn = document.getElementById('btn-server-clear-pause');
    btn.innerText = isServerClearPaused ? "RETOMAR" : "PAUSAR";
    document.getElementById('progress-status-server').innerText = isServerClearPaused ? "PAUSADO..." : "LIMPANDO...";
}

async function startServerClearProcess() { // Nome alterado para ser chamado pelo modal
    const token = localStorage.getItem('trrx_token');
    const btnStart = document.getElementById('btn-server-clear-start');
    const btnPause = document.getElementById('btn-server-clear-pause');
    const btnCancel = document.getElementById('btn-server-clear-cancel');
    const bar = document.getElementById('progress-bar-server');
    const txtCount = document.getElementById('progress-text-server');
    const container = document.getElementById('progress-container-server');

    // Removemos o "if(!confirm...)" pois agora usamos o modal visual
    isServerClearPaused = false;
    isServerClearCancelled = false;
    btnStart.classList.add('hidden');
    btnPause.classList.remove('hidden');
    btnCancel.classList.remove('hidden');
    container.classList.remove('hidden');

    let totalDeleted = 0;

    for (const channel of serverChannelsToClean) {
        if (isServerClearCancelled) break;
        document.getElementById('progress-status-server').innerText = `LIMPANDO #${channel.name.toUpperCase()}...`;

        let lastId = null;
        let hasMore = true;

        while (hasMore && !isServerClearCancelled) {
            while (isServerClearPaused && !isServerClearCancelled) { await new Promise(r => setTimeout(r, 500)); }
            
            try {
                let url = `https://discord.com/api/v9/channels/${channel.id}/messages?limit=100`;
                if (lastId) url += `&before=${lastId}`;

                const res = await axios.get(url, { headers: { 'Authorization': token } });
                if (res.data.length === 0) { hasMore = false; break; }

                const myMsgs = res.data.filter(m => m.author.id === currentMyId);
                lastId = res.data[res.data.length - 1].id;

                for (const msg of myMsgs) {
                    if (isServerClearCancelled) break;
                    while (isServerClearPaused && !isServerClearCancelled) { await new Promise(r => setTimeout(r, 500)); }

                    await axios.delete(`https://discord.com/api/v9/channels/${channel.id}/messages/${msg.id}`, {
                        headers: { 'Authorization': token }
                    });
                    
                    totalDeleted++;
                    txtCount.innerText = `${totalDeleted} APAGADAS`;
                    bar.style.width = '100%'; // Indica atividade
                    
                    // Incremento Global e Persistência
                    if (userPlan.type === 'FREE') {
                        dmDeleteCounter++;
                        localStorage.setItem(`usage_${currentMyId}`, JSON.stringify({ 
                            month: new Date().getMonth() + "-" + new Date().getFullYear(), 
                            count: dmDeleteCounter 
                        }));
                        if (dmDeleteCounter >= DM_FREE_LIMIT) {
                            createToast("LIMITE ATINGIDO", "red");
                            isServerClearCancelled = true;
                            break;
                        }
                    }
                    await new Promise(r => setTimeout(r, 1100));
                }
                if (res.data.length < 100) hasMore = false;
            } catch (err) {
                if (err.response?.status === 429) {
                    await new Promise(r => setTimeout(r, (err.response.data.retry_after || 5) * 1000));
                } else { hasMore = false; }
            }
        }
    }

    createToast(isServerClearCancelled ? "LIMPEZA PARADA" : "SERVIDOR LIMPO!", isServerClearCancelled ? "red" : "green");
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnCancel.classList.add('hidden');
    document.getElementById('progress-status-server').innerText = isServerClearCancelled ? "CANCELADO" : "CONCLUÍDO";
}

// Função para abrir o modal de confirmação do servidor
function openServerClearConfirmation() {
    document.getElementById('server-clear-modal').classList.remove('hidden');
}

// Função para processar a escolha do usuário no modal
function closeServerConfirm(confirmAction) {
    document.getElementById('server-clear-modal').classList.add('hidden');
    if (confirmAction) {
        // Se confirmou, executa a lógica de limpeza que já existia
        startServerClearProcess();
    }
}

// --- SISTEMA DE ADMINISTRAÇÃO DE USUÁRIOS (FIREBASE) ---
let allUsersData = {}; // Certifique-se que esta linha existe no topo do arquivo ou antes da função

async function renderUserList() {
    const container = document.getElementById('users-list-container');
    const search = document.getElementById('user-search').value.toLowerCase();
    const filter = document.getElementById('user-filter').value;
    
    const snapshot = await db.ref('users').once('value');
    allUsersData = snapshot.val() || {}; // ATUALIZA A VARIÁVEL GLOBAL
    
    container.innerHTML = '';
    const rank = { 'DEVELOPER': 3, 'PREMIUM': 2, 'FREE': 1 };
    let usersArray = Object.keys(allUsersData).map(id => ({ id, ...allUsersData[id] }));
    
    usersArray.sort((a, b) => (rank[b.plan?.type] || 0) - (rank[a.plan?.type] || 0));

    usersArray.forEach(user => {
        const pType = user.plan?.type || "FREE";
        const isBanned = user.ban?.active || false;
        const username = user.username || "Usuario";

        if (filter !== 'ALL' && filter !== 'BANNED' && pType !== filter) return;
        if (filter === 'BANNED' && !isBanned) return;
        if (search && !user.id.includes(search) && !username.toLowerCase().includes(search)) return;

        const card = document.createElement('div');
        card.className = `glass p-6 rounded-[2.5rem] border ${isBanned ? 'border-red-600/30' : 'border-white/5'} relative animate-in`;
        
        card.innerHTML = `
            <div class="flex items-center gap-4 mb-6">
                <div class="w-12 h-12 rounded-full dynamic-ghost-bg flex items-center justify-center font-black text-white">${username.charAt(0).toUpperCase()}</div>
                <div class="flex-1 overflow-hidden">
                    <h4 class="text-[11px] font-black text-white uppercase truncate">${username}</h4>
                    <p class="text-[8px] text-gray-500 font-mono">${user.id}</p>
                </div>
                <span class="text-[7px] font-black px-3 py-1 rounded-full ${isBanned ? 'bg-red-600' : (pType === 'FREE' ? 'bg-white/10' : 'bg-yellow-500/20 text-yellow-500')} uppercase italic">${isBanned ? 'BANIDO' : pType}</span>
            </div>
            
            <div class="space-y-2">
                ${!isBanned ? `
                    <button onclick="openPremiumManageUI('${user.id}')" class="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 py-3 rounded-xl text-[8px] font-black uppercase transition-all">Gerenciar Premium</button>
                    <button onclick="openBanModalUI('${user.id}')" class="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 py-3 rounded-xl text-[8px] font-black uppercase transition-all">Banir Acesso</button>
                ` : `
                    <button onclick="unbanUser('${user.id}')" class="w-full bg-green-500/10 hover:bg-green-500/20 text-green-500 py-3 rounded-xl text-[8px] font-black uppercase transition-all">Remover Banimento</button>
                `}
            </div>
        `;
        container.appendChild(card);
    });
}


async function openPremiumManageUI(userId) {
    const user = allUsersData[userId];
    const isPremium = user.plan?.type === 'PREMIUM' || user.plan?.type === 'DEVELOPER';
    const username = user.username || "Usuário";

    document.getElementById('premium-target-name').innerText = username.toUpperCase();
    document.getElementById('premium-manage-modal').classList.remove('hidden');

    const addSection = document.getElementById('premium-add-section');
    const removeSection = document.getElementById('premium-remove-section');

    if (isPremium) {
        addSection.classList.add('hidden');
        removeSection.classList.remove('hidden');
        document.getElementById('btn-revoke-premium').onclick = () => executePlanUpdate(userId, 'FREE', 0);
    } else {
        addSection.classList.remove('hidden');
        removeSection.classList.add('hidden');
        document.getElementById('premium-days-input').value = "30";
        document.getElementById('btn-save-premium').onclick = () => {
            const days = parseInt(document.getElementById('premium-days-input').value);
            if (isNaN(days) || days <= 0) return createToast("INSIRA UM NÚMERO DE DIAS VÁLIDO", "red");
            executePlanUpdate(userId, 'PREMIUM', days);
        };
    }
}

function closePremiumModal() {
    document.getElementById('premium-manage-modal').classList.add('hidden');
}

async function executePlanUpdate(userId, type, days) {
    const expires = type === 'FREE' ? null : Date.now() + (days * 86400000);
    const note = document.getElementById('premium-note-input').value || "";

    const planData = {
        type: type,
        expires: expires,
        addedBy: currentMyId,
        note: note.toUpperCase()
    };

    try {
        await db.ref(`users/${userId}/plan`).set(planData);
        
        createToast(`USUÁRIO ATUALIZADO PARA ${type}!`, "green");
        closePremiumModal();
        
        if (userId === currentMyId) checkAdmin();
        
        renderUserList();
    } catch (e) {
        createToast("ERRO AO SALVAR NA NUVEM", "red");
    }
}

function openBanModalUI(userId) {
    document.getElementById('ban-modal').classList.remove('hidden');
    document.getElementById('btn-confirm-ban').onclick = () => executeBanAction(userId);
}

function closeBanModal() {
    document.getElementById('ban-modal').classList.add('hidden');
}

async function executeBanAction(userId) {
    const reason = document.getElementById('ban-reason').value || "Violação de Termos";
    const days = parseInt(document.getElementById('ban-days').value) || 0;
    const expires = days === 0 ? "PERMANENTE" : Date.now() + (days * 86400000);

    await db.ref(`users/${userId}/ban`).set({
        active: true,
        reason: reason.toUpperCase(),
        expires: expires,
        date: Date.now()
    });

    closeBanModal();
    createToast("USUÁRIO BLOQUEADO!", "red");
    renderUserList();
}

async function unbanUser(userId) {
    await db.ref(`users/${userId}/ban`).remove();
    createToast("ACESSO RESTAURADO!", "green");
    renderUserList();
}


async function verifyAccess() {
    const snapshot = await db.ref(`users/${currentMyId}/ban`).once('value');
    const ban = snapshot.val();
    if (ban && ban.active) {
        if (ban.expires !== "PERMANENTE" && Date.now() > ban.expires) {
            await unbanUser(currentMyId);
            return;
        }
        window.location.href = 'banido.html';
    }
}

// ESCUTA EVENTOS DE ATUALIZAÇÃO DO ELECTRON (MODO SEGURO E COMPLETO)
function initAutoUpdateListeners() {
    if (window.electronAPI) {
        console.log("%c[TRRX LOG] Sistema de Auto-Update vinculado.", "color: #3b82f6; font-weight: bold;");
        createToast("SISTEMA DE ATUALIZAÇÃO ATIVO", "green");

        window.electronAPI.onUpdateAvailable((event, version) => {
            console.log("[TRRX LOG] Versão detectada no GitHub: v" + version);
            createToast("VERSÃO V" + version + " ENCONTRADA!", "green");
            
            const modal = document.getElementById('update-modal');
            const status = document.getElementById('update-status');
            if (modal) modal.classList.remove('hidden');
            if (status) status.innerText = `NOVA VERSÃO ${version} ENCONTRADA`;
            document.getElementById('splash-screen').style.display = 'flex'; 
        });

        window.electronAPI.onUpdateProgress((event, percent) => {
            const p = Math.floor(percent);
            const bar = document.getElementById('update-progress-bar');
            const txt = document.getElementById('update-percent');
            if (bar) bar.style.width = p + '%';
            if (txt) txt.innerText = p + '%';
        });

        window.electronAPI.onUpdateDownloaded(() => {
            console.log("[TRRX LOG] Download finalizado.");
            createToast("INSTALANDO ATUALIZAÇÃO...", "green");
            document.getElementById('update-status').innerText = "INSTALANDO...";
        });

    } else {
        console.error("[TRRX LOG] ERRO: electronAPI não encontrada. Você está no navegador?");
        // Não mostramos toast aqui para não poluir o site normal
    }
}

// Inicializa o Splash e os Listeners
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    const main = document.getElementById('main-wrapper');

    if (window.electronAPI) initAutoUpdateListeners();

    setTimeout(() => {
        if (document.getElementById('update-modal').classList.contains('hidden')) {
            splash.style.display = 'none';
            main.style.display = 'block';
            document.body.style.overflow = 'auto';
        }
    }, 3000);
});

// Inicializa quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', initAutoUpdateListeners);

// CONTROLE DE INICIALIZAÇÃO E ATUALIZAÇÃO
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    const main = document.getElementById('main-wrapper');
    const statusTxt = document.getElementById('splash-status');

    // Ativa os ouvintes se estiver no Electron
    if (window.electronAPI) {
        initAutoUpdateListeners();
    }

    // Timer de 3 segundos para o Splash
    setTimeout(() => {
        const updateModal = document.getElementById('update-modal');
        // Se NÃO estiver baixando atualização, libera o app
        if (updateModal.classList.contains('hidden')) {
            splash.style.display = 'none';
            main.style.display = 'block';
            document.body.style.overflow = 'auto';
        } else {
            statusTxt.innerText = "ATUALIZAÇÃO EM CURSO...";
        }
    }, 3000);
});