(function () {
    'use strict';

    let eu = null;
    let ws = null;
    let historicoCarregado = false;
    let naoLidas = 0;
    let arquivoSelecionado = null;
    let ultimoAutor = null;
    let ultimaData = null;
    let mensagensCarregadas = [];
    let modoSearch = false;
    let digitandoTimers = {};
    let ultimoDigitando = 0;
    let replyingTo = null;

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
        const d = new Date(iso);
        const hoje = new Date();
        const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
        if (d.toDateString() === hoje.toDateString()) return 'Hoje';
        if (d.toDateString() === ontem.toDateString()) return 'Ontem';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
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
        return ['jpg','jpeg','png','gif','webp','bmp','svg'].includes((nome||'').split('.').pop().toLowerCase());
    }

    function isAudio(tipo, nome) {
        if (tipo && tipo.startsWith('audio/')) return true;
        return ['mp3','wav','ogg','m4a','opus','aac'].includes((nome||'').split('.').pop().toLowerCase());
    }

    // ── Favicon dinâmico com badge ──

    function atualizarFavicon(count) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 32; canvas.height = 32;
            const c = canvas.getContext('2d');

            c.fillStyle = '#234653';
            if (c.roundRect) { c.beginPath(); c.roundRect(0, 0, 32, 32, 7); c.fill(); }
            else { c.fillRect(0, 0, 32, 32); }

            c.fillStyle = '#fff';
            c.font = 'bold 20px sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('L', count > 0 ? 12 : 16, 16);

            if (count > 0) {
                c.fillStyle = '#C0392B';
                c.beginPath(); c.arc(24, 8, 9, 0, 2 * Math.PI); c.fill();
                c.fillStyle = '#fff';
                c.font = 'bold 10px sans-serif';
                c.textAlign = 'center'; c.textBaseline = 'middle';
                c.fillText(count > 9 ? '9+' : String(count), 24, 8);
            }

            let link = document.querySelector("link[rel~='icon']");
            if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
            link.href = canvas.toDataURL();
        } catch { /* silencioso */ }
    }

    // ── Notificações ──

    function tocarSom() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25);
        } catch { /* silencioso */ }
    }

    function notificar(nome, texto) {
        const painelAberto = document.getElementById('cwPainel')?.classList.contains('aberto');
        if (painelAberto && document.visibilityState === 'visible') return;
        tocarSom();
        atualizarFavicon(naoLidas);
        if (Notification.permission === 'granted') {
            new Notification(`💬 ${nome}`, { body: texto || '📎 enviou um arquivo', tag: 'luxmenu-chat' });
        }
    }

    // ── Renderização ──

    function renderArquivo(msg) {
        if (!msg.arquivo_url) return '';
        const mt = msg.texto ? '6px' : '0';
        if (isImagem(msg.arquivo_tipo, msg.arquivo_nome)) {
            return `<a href="${esc(msg.arquivo_url)}" target="_blank" rel="noopener">
                      <img src="${esc(msg.arquivo_url)}" alt="${esc(msg.arquivo_nome)}"
                           style="max-width:220px;max-height:160px;border-radius:8px;display:block;margin-top:${mt}">
                    </a>`;
        }
        if (isAudio(msg.arquivo_tipo, msg.arquivo_nome)) {
            return `<audio controls src="${esc(msg.arquivo_url)}"
                        style="max-width:220px;display:block;margin-top:${mt}"></audio>`;
        }
        return `<a class="cw-arq-link" href="${esc(msg.arquivo_url)}" target="_blank" rel="noopener"
                   download="${esc(msg.arquivo_nome)}" style="margin-top:${mt}">
                  <span class="cw-arq-icone">📎</span>
                  <span class="cw-arq-info">
                    <span class="cw-arq-nome">${esc(msg.arquivo_nome)}</span>
                    <span class="cw-arq-tam">${formatTam(msg.arquivo_tam)}</span>
                  </span>
                </a>`;
    }

    function adicionarMsg(msg, historico) {
        document.getElementById('cwVazio')?.remove();
        mensagensCarregadas.push(msg);

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
        if (msg.id) div.dataset.id = msg.id;

        const mostrarNome = !minha && ultimoAutor !== msg.username;
        const textoHtml = msg.texto ? `<span>${esc(msg.texto)}</span>` : '';

        if (msg.texto) div.dataset.texto = msg.texto;
        if (minha)     div.dataset.minha = '1';
        div.dataset.nome = msg.nome;

        const replyHtml = msg.reply_to_id
            ? `<div class="cw-reply-quote">
                   <span class="cw-reply-autor">${esc(msg.reply_to_nome || '')}</span>
                   <span class="cw-reply-trecho">${esc((msg.reply_to_texto || '').slice(0, 120))}</span>
               </div>` : '';

        div.innerHTML = `
            ${mostrarNome ? `<span class="cw-nome">${esc(msg.nome)}</span>` : ''}
            <div class="cw-balao-wrap">
                <div class="cw-balao">
                    ${replyHtml}
                    ${textoHtml}
                    ${renderArquivo(msg)}
                    <span class="cw-hora">${formatHora(msg.enviado_em)}</span>
                </div>
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
        el.innerHTML = usuarios.map(u => `<span class="cw-chip-online">${esc(u.nome.split(' ')[0])}</span>`).join('');
    }

    // ── Deletar ──

    async function deletarMensagem(id) {
        try { await fetch(`/api/chat/mensagens/${id}`, { method: 'DELETE' }); }
        catch { /* silencioso */ }
    }

    function removerMsgDom(id) {
        const el = document.querySelector(`.cw-msg[data-id="${id}"]`);
        if (!el) return;
        el.style.transition = 'opacity .2s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 200);
        mensagensCarregadas = mensagensCarregadas.filter(m => String(m.id) !== String(id));
    }

    // ── Busca ──

    function buscarMensagens(termo) {
        const el = document.getElementById('cwMsgs');
        if (!termo.trim()) {
            // Restaura visão normal
            modoSearch = false;
            el.innerHTML = '<p id="cwVazio" class="cw-vazio">Carregando…</p>';
            ultimoAutor = null; ultimaData = null;
            const backup = mensagensCarregadas.slice();
            mensagensCarregadas = [];
            for (const m of backup) adicionarMsg(m, true);
            el.scrollTop = el.scrollHeight;
            return;
        }
        modoSearch = true;
        const t = termo.toLowerCase();
        const resultados = mensagensCarregadas.filter(m =>
            (m.texto || '').toLowerCase().includes(t) ||
            (m.arquivo_nome || '').toLowerCase().includes(t) ||
            (m.nome || '').toLowerCase().includes(t)
        );

        el.innerHTML = resultados.length
            ? resultados.map(m => {
                const minha = m.username === eu.username;
                const textoHighlight = (m.texto || '').replace(
                    new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                    match => `<mark>${esc(match)}</mark>`
                );
                return `<div class="cw-search-item ${minha ? 'minha' : ''}">
                    <span class="cw-search-meta">${esc(m.nome)} · ${formatData(m.enviado_em)} ${formatHora(m.enviado_em)}</span>
                    <span>${textoHighlight || (m.arquivo_nome ? `📎 ${esc(m.arquivo_nome)}` : '')}</span>
                  </div>`;
            }).join('')
            : '<p class="cw-vazio">Nenhuma mensagem encontrada.</p>';
    }

    // ── Indicador digitando ──

    function mostrarDigitando(nome, username) {
        const el = document.getElementById('cwDigitando');
        if (!el) return;
        clearTimeout(digitandoTimers[username]);
        el.textContent = `${nome.split(' ')[0]} está digitando…`;
        el.style.display = 'block';
        digitandoTimers[username] = setTimeout(() => {
            el.style.display = 'none';
            el.textContent = '';
        }, 2500);
    }

    // ── WebSocket ──

    function conectarWs() {
        if (ws && ws.readyState <= 1) return;
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}/chat/ws`);
        ws.addEventListener('message', (e) => {
            const dados = JSON.parse(e.data);
            if (dados.tipo === 'mensagem') {
                if (!modoSearch) adicionarMsg(dados, false);
                else mensagensCarregadas.push(dados);
                if (dados.username !== eu.username) notificar(dados.nome, dados.texto);
            }
            if (dados.tipo === 'online')   renderOnline(dados.usuarios);
            if (dados.tipo === 'deletar')  removerMsgDom(dados.id);
            if (dados.tipo === 'digitando') mostrarDigitando(dados.nome, dados.username);
        });
        ws.addEventListener('close', () => setTimeout(conectarWs, 3000));
    }

    async function carregarHistorico() {
        if (historicoCarregado) return;
        historicoCarregado = true;
        ultimoAutor = null; ultimaData = null;
        try {
            const msgs = await fetch('/api/chat/historico').then(r => r.json());
            for (const m of msgs) adicionarMsg(m, true);
            document.getElementById('cwMsgs').scrollTop = 9999;
        } catch { /* silencioso */ }
    }

    // ── Envio ──

    function limparReply() {
        replyingTo = null;
        const bar = document.getElementById('cwReplyPreview');
        if (bar) bar.style.display = 'none';
    }

    async function enviar() {
        const textoEl = document.getElementById('cwTexto');
        const texto = textoEl.value.trim();
        if (!texto && !arquivoSelecionado) return;

        if (arquivoSelecionado) {
            const fd = new FormData();
            fd.append('arquivo', arquivoSelecionado);
            if (texto) fd.append('texto', texto);
            if (replyingTo) {
                fd.append('reply_to_id',    replyingTo.id);
                fd.append('reply_to_nome',  replyingTo.nome);
                fd.append('reply_to_texto', replyingTo.texto);
            }
            try { await fetch('/api/chat/arquivo', { method: 'POST', body: fd }); }
            catch { /* silencioso */ }
            limparArquivo();
        } else {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    texto,
                    reply_to_id:    replyingTo?.id    ?? null,
                    reply_to_nome:  replyingTo?.nome  ?? null,
                    reply_to_texto: replyingTo?.texto ?? null,
                }));
            }
        }
        limparReply();
        textoEl.value = '';
        textoEl.style.height = '36px';
    }

    function limparArquivo() {
        arquivoSelecionado = null;
        const p = document.getElementById('cwArqPreview'); if (p) p.style.display = 'none';
        const i = document.getElementById('cwArqInput');   if (i) i.value = '';
    }

    // ── Injeção do HTML ──

    function injetar() {
        const btn = document.createElement('div');
        btn.id = 'cwBtnWrap';
        btn.innerHTML = `<button id="cwBtn" title="Chat da equipe">💬
            <span id="cwBadge" style="display:none">0</span></button>`;

        const painel = document.createElement('div');
        painel.id = 'cwPainel';
        painel.innerHTML = `
            <div id="cwHeader">
                <div>
                    <strong>Chat da equipe</strong>
                    <div id="cwOnline"></div>
                    <div id="cwDigitando" style="display:none"></div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                    <button id="cwBuscarBtn" title="Pesquisar mensagens">🔍</button>
                    <button id="cwFechar" title="Fechar">✕</button>
                </div>
            </div>
            <div id="cwSearchBar" style="display:none">
                <input id="cwSearchInput" placeholder="Buscar nas mensagens…" type="text">
                <button id="cwSearchFechar">✕</button>
            </div>
            <div id="cwMsgs">
                <p id="cwVazio" class="cw-vazio">Nenhuma mensagem ainda.</p>
            </div>
            <div id="cwReplyPreview" style="display:none">
                <div class="cw-rp-info">
                    <strong id="cwReplyNome"></strong>
                    <span id="cwReplyTexto"></span>
                </div>
                <button id="cwReplyRemover" title="Cancelar resposta">✕</button>
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

        // Abrir painel
        document.getElementById('cwBtn').addEventListener('click', () => {
            painel.classList.add('aberto');
            document.getElementById('cwBtnWrap').style.display = 'none';
            naoLidas = 0;
            document.getElementById('cwBadge').style.display = 'none';
            atualizarFavicon(0);
            carregarHistorico();
            setTimeout(() => document.getElementById('cwTexto').focus(), 200);
        });

        // Fechar painel
        document.getElementById('cwFechar').addEventListener('click', () => {
            painel.classList.remove('aberto');
            document.getElementById('cwBtnWrap').style.display = '';
        });

        // Busca
        document.getElementById('cwBuscarBtn').addEventListener('click', () => {
            const bar = document.getElementById('cwSearchBar');
            bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
            if (bar.style.display === 'flex') document.getElementById('cwSearchInput').focus();
            else { document.getElementById('cwSearchInput').value = ''; buscarMensagens(''); }
        });

        let debSearch;
        document.getElementById('cwSearchInput').addEventListener('input', (e) => {
            clearTimeout(debSearch);
            debSearch = setTimeout(() => buscarMensagens(e.target.value), 250);
        });

        document.getElementById('cwSearchFechar').addEventListener('click', () => {
            document.getElementById('cwSearchBar').style.display = 'none';
            document.getElementById('cwSearchInput').value = '';
            buscarMensagens('');
        });

        // Envio
        document.getElementById('cwEnviar').addEventListener('click', enviar);
        document.getElementById('cwTexto').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
        });
        document.getElementById('cwTexto').addEventListener('input', function () {
            this.style.height = '36px';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            const agora = Date.now();
            if (ws?.readyState === WebSocket.OPEN && agora - ultimoDigitando > 2000) {
                ultimoDigitando = agora;
                ws.send(JSON.stringify({ tipo: 'digitando' }));
            }
        });

        document.getElementById('cwTexto').addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (!file) return;
                    arquivoSelecionado = file;
                    document.getElementById('cwArqNome').textContent = 'imagem colada';
                    document.getElementById('cwArqPreview').style.display = 'flex';
                    return;
                }
            }
        });

        // Arquivo
        document.getElementById('cwArqInput').addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            arquivoSelecionado = file;
            document.getElementById('cwArqNome').textContent = file.name;
            document.getElementById('cwArqPreview').style.display = 'flex';
        });
        document.getElementById('cwArqRemover').addEventListener('click', limparArquivo);
        document.getElementById('cwReplyRemover').addEventListener('click', limparReply);

        // Menu de contexto (clique direito nas mensagens)
        const ctxMenu = document.createElement('div');
        ctxMenu.id = 'cwContextMenu';
        ctxMenu.style.display = 'none';
        document.body.appendChild(ctxMenu);

        ctxMenu.addEventListener('click', (e) => e.stopPropagation());

        function fecharCtx() { ctxMenu.style.display = 'none'; }
        document.addEventListener('click', fecharCtx);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharCtx(); });

        document.getElementById('cwMsgs').addEventListener('contextmenu', (e) => {
            const msgEl = e.target.closest('.cw-msg');
            if (!msgEl) return;
            e.preventDefault();

            const id    = msgEl.dataset.id;
            const texto = msgEl.dataset.texto;
            const minha = msgEl.dataset.minha === '1';

            ctxMenu.innerHTML = '';

            const itemReply = document.createElement('button');
            itemReply.className = 'cw-ctx-item';
            itemReply.innerHTML = '↩ Responder';
            itemReply.addEventListener('click', () => {
                replyingTo = { id: Number(id), nome: msgEl.dataset.nome || '', texto: texto || '' };
                const bar = document.getElementById('cwReplyPreview');
                document.getElementById('cwReplyNome').textContent  = replyingTo.nome;
                document.getElementById('cwReplyTexto').textContent = replyingTo.texto.slice(0, 80) || '📎 arquivo';
                bar.style.display = 'flex';
                fecharCtx();
                document.getElementById('cwTexto').focus();
            });
            ctxMenu.appendChild(itemReply);

            if (texto) {
                const sep = document.createElement('div');
                sep.className = 'cw-ctx-sep';
                ctxMenu.appendChild(sep);

                const item = document.createElement('button');
                item.className = 'cw-ctx-item';
                item.innerHTML = '📋 Copiar mensagem';
                item.addEventListener('click', async () => {
                    await copiarTexto(texto);
                    fecharCtx();
                });
                ctxMenu.appendChild(item);
            }

            if (minha && id) {
                if (texto) {
                    const sep = document.createElement('div');
                    sep.className = 'cw-ctx-sep';
                    ctxMenu.appendChild(sep);
                }
                const itemDel = document.createElement('button');
                itemDel.className = 'cw-ctx-item cw-ctx-danger';
                itemDel.innerHTML = '🗑 Apagar mensagem';
                itemDel.addEventListener('click', () => {
                    ctxMenu.innerHTML = `<div class="cw-ctx-confirm">Apagar esta mensagem?</div>`;
                    const sim = document.createElement('button');
                    sim.className = 'cw-ctx-item cw-ctx-danger';
                    sim.textContent = '✓ Sim, apagar';
                    sim.addEventListener('click', () => { deletarMensagem(id); fecharCtx(); });
                    const nao = document.createElement('button');
                    nao.className = 'cw-ctx-item';
                    nao.textContent = 'Cancelar';
                    nao.addEventListener('click', fecharCtx);
                    ctxMenu.appendChild(sim);
                    ctxMenu.appendChild(nao);
                });
                ctxMenu.appendChild(itemDel);
            }

            if (!ctxMenu.children.length) return;

            ctxMenu.style.display = 'block';
            const x = Math.min(e.clientX, window.innerWidth  - ctxMenu.offsetWidth  - 8);
            const y = Math.min(e.clientY, window.innerHeight - ctxMenu.offsetHeight - 8);
            ctxMenu.style.left = x + 'px';
            ctxMenu.style.top  = y + 'px';
        });
    }

    // ── Init ──

    async function init() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) return;
            eu = await res.json();
            injetar();
            conectarWs();
            if (Notification.permission === 'default') Notification.requestPermission();
        } catch { /* silencioso */ }
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);
})();
