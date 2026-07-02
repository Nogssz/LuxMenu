(function () {
    'use strict';

    let eu = null;
    let ws = null;
    let historicoCarregado = false;
    let naoLidas = 0;
    let arquivoSelecionado = null;
    let ultimoAutor = null;
    let ultimaData = null;

    // ── Helpers ──

    function esc(str) {
        return String(str ?? '').replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
        );
    }

    function formatHora(iso) {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function formatData(iso) {
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    function mesmaData(a, b) {
        return a && b && new Date(a).toDateString() === new Date(b).toDateString();
    }

    function formatTam(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function isImagem(tipo, nome) {
        if (tipo && tipo.startsWith('image/')) return true;
        const ext = (nome || '').split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    }

    // ── Renderização de mensagem ──

    function renderArquivo(msg) {
        if (!msg.arquivo_url) return '';
        if (isImagem(msg.arquivo_tipo, msg.arquivo_nome)) {
            return `<a href="${esc(msg.arquivo_url)}" target="_blank" rel="noopener">
                        <img src="${esc(msg.arquivo_url)}" alt="${esc(msg.arquivo_nome)}"
                             style="max-width:220px;max-height:160px;border-radius:8px;display:block;margin-top:${msg.texto ? '6px' : '0'}">
                    </a>`;
        }
        return `<a class="cw-arq-link" href="${esc(msg.arquivo_url)}" target="_blank" rel="noopener"
                   download="${esc(msg.arquivo_nome)}" style="margin-top:${msg.texto ? '6px' : '0'}">
                    <span class="cw-arq-icone">📎</span>
                    <span class="cw-arq-info">
                        <span class="cw-arq-nome">${esc(msg.arquivo_nome)}</span>
                        <span class="cw-arq-tam">${formatTam(msg.arquivo_tam)}</span>
                    </span>
                </a>`;
    }

    function adicionarMsg(msg, historico) {
        const vazio = document.getElementById('cwVazio');
        if (vazio) vazio.remove();

        const minha = msg.username === eu.username;
        const msgs = document.getElementById('cwMsgs');

        if (!mesmaData(ultimaData, msg.enviado_em)) {
            const sep = document.createElement('div');
            sep.className = 'cw-sep';
            sep.textContent = formatData(msg.enviado_em);
            msgs.appendChild(sep);
            ultimoAutor = null;
        }
        ultimaData = msg.enviado_em;

        const div = document.createElement('div');
        div.className = 'cw-msg ' + (minha ? 'minha' : 'outra');

        const mostrarNome = !minha && ultimoAutor !== msg.username;
        const textoHtml = msg.texto ? `<span>${esc(msg.texto)}</span>` : '';

        div.innerHTML = `
            ${mostrarNome ? `<span class="cw-nome">${esc(msg.nome)}</span>` : ''}
            <div class="cw-balao">
                ${textoHtml}
                ${renderArquivo(msg)}
                <span class="cw-hora">${formatHora(msg.enviado_em)}</span>
            </div>`;

        msgs.appendChild(div);
        ultimoAutor = msg.username;

        if (!historico) {
            msgs.scrollTop = msgs.scrollHeight;
            if (!document.getElementById('cwPainel').classList.contains('aberto')) {
                naoLidas++;
                const badge = document.getElementById('cwBadge');
                badge.textContent = naoLidas > 9 ? '9+' : naoLidas;
                badge.style.display = 'flex';
            }
        }
    }

    function renderOnline(usuarios) {
        const el = document.getElementById('cwOnline');
        if (!el) return;
        el.innerHTML = usuarios.map(u =>
            `<span class="cw-chip-online">${esc(u.nome.split(' ')[0])}</span>`
        ).join('');
    }

    // ── Notificações ──

    function tocarSom() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } catch { /* silencioso */ }
    }

    function notificar(nome, texto) {
        const painelAberto = document.getElementById('cwPainel')?.classList.contains('aberto');
        if (painelAberto && document.visibilityState === 'visible') return;
        tocarSom();
        if (Notification.permission === 'granted') {
            new Notification(`💬 ${nome}`, {
                body: texto || '📎 enviou um arquivo',
                tag: 'luxmenu-chat',
            });
        }
    }

    // ── WebSocket ──

    function conectarWs() {
        if (ws && ws.readyState <= 1) return;
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}/chat/ws`);
        ws.addEventListener('message', (e) => {
            const dados = JSON.parse(e.data);
            if (dados.tipo === 'mensagem') {
                adicionarMsg(dados, false);
                if (dados.username !== eu.username) notificar(dados.nome, dados.texto);
            }
            if (dados.tipo === 'online') renderOnline(dados.usuarios);
        });
        ws.addEventListener('close', () => setTimeout(conectarWs, 3000));
    }

    async function carregarHistorico() {
        if (historicoCarregado) return;
        historicoCarregado = true;
        ultimoAutor = null;
        ultimaData = null;
        try {
            const msgs = await fetch('/api/chat/historico').then(r => r.json());
            for (const m of msgs) adicionarMsg(m, true);
            const el = document.getElementById('cwMsgs');
            el.scrollTop = el.scrollHeight;
        } catch { /* silencioso */ }
    }

    // ── Envio ──

    async function enviar() {
        const textoEl = document.getElementById('cwTexto');
        const texto = textoEl.value.trim();
        if (!texto && !arquivoSelecionado) return;

        if (arquivoSelecionado) {
            const fd = new FormData();
            fd.append('arquivo', arquivoSelecionado);
            if (texto) fd.append('texto', texto);
            try {
                await fetch('/api/chat/arquivo', { method: 'POST', body: fd });
            } catch { /* silencioso */ }
            limparArquivo();
        } else {
            if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ texto }));
        }
        textoEl.value = '';
        textoEl.style.height = '36px';
    }

    function limparArquivo() {
        arquivoSelecionado = null;
        const preview = document.getElementById('cwArqPreview');
        if (preview) preview.style.display = 'none';
        const input = document.getElementById('cwArqInput');
        if (input) input.value = '';
    }

    // ── Injeção do HTML ──

    function injetar() {
        const btn = document.createElement('div');
        btn.id = 'cwBtnWrap';
        btn.innerHTML = `
            <button id="cwBtn" title="Chat da equipe">💬
                <span id="cwBadge" style="display:none">0</span>
            </button>`;

        const painel = document.createElement('div');
        painel.id = 'cwPainel';
        painel.innerHTML = `
            <div id="cwHeader">
                <div>
                    <strong>Chat da equipe</strong>
                    <div id="cwOnline"></div>
                </div>
                <button id="cwFechar" title="Fechar">✕</button>
            </div>
            <div id="cwMsgs">
                <p id="cwVazio" class="cw-vazio">Nenhuma mensagem ainda.</p>
            </div>
            <div id="cwArqPreview" style="display:none">
                <span id="cwArqNome"></span>
                <button id="cwArqRemover" title="Remover">✕</button>
            </div>
            <div id="cwForm">
                <label id="cwAnexarLabel" title="Anexar arquivo (máx. 20 MB)">
                    📎<input type="file" id="cwArqInput">
                </label>
                <textarea id="cwTexto" placeholder="Mensagem… (Enter envia)" rows="1"></textarea>
                <button id="cwEnviar">↑</button>
            </div>`;

        document.body.appendChild(btn);
        document.body.appendChild(painel);

        // Eventos
        document.getElementById('cwBtn').addEventListener('click', () => {
            painel.classList.add('aberto');
            document.getElementById('cwBtnWrap').style.display = 'none';
            naoLidas = 0;
            const badge = document.getElementById('cwBadge');
            badge.style.display = 'none';
            carregarHistorico();
            setTimeout(() => document.getElementById('cwTexto').focus(), 200);
        });

        document.getElementById('cwFechar').addEventListener('click', () => {
            painel.classList.remove('aberto');
            document.getElementById('cwBtnWrap').style.display = '';
        });

        document.getElementById('cwEnviar').addEventListener('click', enviar);

        document.getElementById('cwTexto').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
        });

        document.getElementById('cwTexto').addEventListener('input', function () {
            this.style.height = '36px';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });

        document.getElementById('cwArqInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            arquivoSelecionado = file;
            document.getElementById('cwArqNome').textContent = file.name;
            document.getElementById('cwArqPreview').style.display = 'flex';
        });

        document.getElementById('cwArqRemover').addEventListener('click', limparArquivo);
    }

    // ── Init ──

    async function init() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) return; // não autenticado, não injeta nada
            eu = await res.json();
            injetar();
            conectarWs();
            if (Notification.permission === 'default') Notification.requestPermission();
        } catch { /* silencioso */ }
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);
})();
