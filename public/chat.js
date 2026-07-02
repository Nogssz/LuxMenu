const $ = (id) => document.getElementById(id);

let euUsername = null;
let ws = null;
let ultimoAutor = null;
let ultimaData = null;

function formatarHora(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function mesmaData(a, b) {
    if (!a || !b) return false;
    return new Date(a).toDateString() === new Date(b).toDateString();
}

function adicionarMsg(msg, historico = false) {
    const vazio = $('vazio');
    if (vazio) vazio.remove();

    const minha = msg.username === euUsername;
    const container = $('msgs');

    if (!mesmaData(ultimaData, msg.enviado_em)) {
        const sep = document.createElement('div');
        sep.className = 'msg-sep';
        sep.textContent = formatarData(msg.enviado_em);
        container.appendChild(sep);
        ultimoAutor = null;
    }
    ultimaData = msg.enviado_em;

    const div = document.createElement('div');
    div.className = `msg ${minha ? 'minha' : 'outro'}`;

    const mostrarMeta = !minha && ultimoAutor !== msg.username;
    div.innerHTML = `
        ${mostrarMeta ? `<span class="msg-meta">${msg.nome} · ${formatarHora(msg.enviado_em)}</span>` : ''}
        ${!mostrarMeta && !minha ? '' : ''}
        <div class="msg-balao">${msg.texto.replace(/\n/g, '<br>')}</div>
        ${minha ? `<span class="msg-meta">${formatarHora(msg.enviado_em)}</span>` : ''}
    `;
    container.appendChild(div);
    ultimoAutor = msg.username;

    if (!historico) container.scrollTop = container.scrollHeight;
}

function renderOnline(usuarios) {
    $('online').innerHTML = usuarios.map(u =>
        `<span class="online-chip">${u.nome.split(' ')[0]}</span>`
    ).join('') || '<span style="font-size:12px;color:var(--ink-faint)">—</span>';
}

async function iniciar() {
    const me = await fetch('/api/auth/me').then(r => r.json());
    euUsername = me.username;

    const historico = await fetch('/api/chat/historico').then(r => r.json());
    for (const msg of historico) adicionarMsg(msg, true);
    $('msgs').scrollTop = $('msgs').scrollHeight;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/chat/ws`);

    ws.addEventListener('message', (e) => {
        const dados = JSON.parse(e.data);
        if (dados.tipo === 'mensagem') adicionarMsg(dados);
        if (dados.tipo === 'online') renderOnline(dados.usuarios);
    });

    ws.addEventListener('close', () => {
        setTimeout(iniciar, 3000);
    });
}

function enviar() {
    const texto = $('texto').value.trim();
    if (!texto || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ texto }));
    $('texto').value = '';
    $('texto').style.height = '42px';
}

$('btnEnviar').addEventListener('click', enviar);

$('texto').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
});

$('texto').addEventListener('input', () => {
    const t = $('texto');
    t.style.height = '42px';
    t.style.height = Math.min(t.scrollHeight, 120) + 'px';
});

iniciar();
