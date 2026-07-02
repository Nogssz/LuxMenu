// navigator.clipboard só funciona em contexto seguro (HTTPS ou localhost);
// acessando pelo IP da rede local (HTTP simples) ele não existe, daí o fallback.
async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(texto);
            return true;
        } catch (e) { /* cai no fallback abaixo */ }
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch (e) {
        return false;
    }
}

// Tema claro/escuro com a bolinha do switch trocando de avatar (wesleyPixel = claro, inacioPixel = escuro).
// Aplicado em todas as páginas (basta incluir shared.js) e lembrado por navegador via localStorage.
(function () {
    const CHAVE_TEMA = 'luxmenu-tema';
    const AVATAR_CLARO = 'img/wesleyPixel.png';
    const AVATAR_ESCURO = 'img/inacioPixel.png';

    function temaSalvo() {
        return localStorage.getItem(CHAVE_TEMA) === 'escuro' ? 'escuro' : 'claro';
    }

    function aplicarNoDocumento(tema) {
        document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light';
    }

    // Aplica o quanto antes, pra evitar flash de tema claro antes do JS rodar.
    aplicarNoDocumento(temaSalvo());

    function criarToggle() {
        if (document.getElementById('temaToggle')) return;

        const tema = temaSalvo();
        const btn = document.createElement('button');
        btn.id = 'temaToggle';
        btn.type = 'button';
        btn.title = 'Trocar tema claro/escuro';
        if (tema === 'escuro') btn.classList.add('escuro');
        btn.innerHTML = `<span class="bolinha"><img src="${tema === 'escuro' ? AVATAR_ESCURO : AVATAR_CLARO}" alt=""></span>`;

        btn.addEventListener('click', () => {
            const novo = temaSalvo() === 'claro' ? 'escuro' : 'claro';
            localStorage.setItem(CHAVE_TEMA, novo);
            aplicarNoDocumento(novo);
            btn.classList.toggle('escuro', novo === 'escuro');
            btn.querySelector('img').src = novo === 'escuro' ? AVATAR_ESCURO : AVATAR_CLARO;
        });

        document.body.appendChild(btn);
    }

    if (document.body) criarToggle();
    else document.addEventListener('DOMContentLoaded', criarToggle);
})();

// Menu lateral retrátil, igual em todas as páginas, pra trocar de módulo sem
// precisar voltar pro index.html primeiro. Não aparece no próprio index.html
// porque lá a lista de módulos já está na tela.
(function () {
    const MODULOS = [
        { href: 'index.html', icone: '🏠', titulo: 'Menu de módulos' },
        { href: 'Diferimento.html', icone: '%', titulo: 'Diferimento de ICMS' },
        { href: 'fechamento.html', icone: '✓', titulo: 'Fechamento de Mês' },
        { href: 'consulta-cnpj.html', icone: '🔎', titulo: 'Consulta CNPJ' },
        { href: 'videos.html', icone: '▶', titulo: 'Vídeos Tutoriais' },
        { href: 'arquivos.html', icone: '📁', titulo: 'Arquivos' },
        { href: 'escala.html', icone: '📅', titulo: 'Escala de Sábados' },
        { href: 'agenda.html', icone: '📆', titulo: 'Agenda' },
        { href: 'chat.html', icone: '💬', titulo: 'Chat da equipe' },
    ];

    function paginaAtual() {
        const partes = location.pathname.split('/');
        return partes[partes.length - 1] || 'index.html';
    }

    function criarMenuLateral() {
        const atual = paginaAtual();
        if (atual === 'index.html' || atual === '') return;
        if (document.getElementById('menuLateral')) return;

        const overlay = document.createElement('div');
        overlay.id = 'menuLateralOverlay';

        const painel = document.createElement('nav');
        painel.id = 'menuLateral';
        painel.innerHTML = `<p class="ml-titulo">Módulos</p>` + MODULOS.map(m =>
            `<a class="ml-item${m.href === atual ? ' ativo' : ''}" href="${m.href}"><span class="ml-icone">${m.icone}</span>${m.titulo}</a>`
        ).join('');

        const btn = document.createElement('button');
        btn.id = 'menuLateralToggle';
        btn.type = 'button';
        btn.title = 'Trocar de módulo';
        btn.innerHTML = '☰';

        function abrir() {
            painel.classList.add('aberto');
            overlay.classList.add('show');
            btn.classList.add('aberto');
        }
        function fechar() {
            painel.classList.remove('aberto');
            overlay.classList.remove('show');
            btn.classList.remove('aberto');
        }

        btn.addEventListener('click', () => {
            painel.classList.contains('aberto') ? fechar() : abrir();
        });
        overlay.addEventListener('click', fechar);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

        document.body.appendChild(overlay);
        document.body.appendChild(painel);
        document.body.appendChild(btn);
    }

    if (document.body) criarMenuLateral();
    else document.addEventListener('DOMContentLoaded', criarMenuLateral);
})();

// Barra de usuário logado: mostra nome + botão de sair, fixo no topo direito
// (ao lado do botão de tema, que fica em top:14px right:14px).
(function () {
    async function criarBarraUsuario() {
        if (document.getElementById('barraUsuario')) return;
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) return;
            const usuario = await res.json();

            const barra = document.createElement('div');
            barra.id = 'barraUsuario';
            barra.innerHTML = `<span class="bu-nome">${usuario.nome.split(' ')[0]}</span><button class="bu-sair" title="Sair">↩</button>`;

            barra.querySelector('.bu-sair').addEventListener('click', async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login.html';
            });

            document.body.appendChild(barra);
        } catch { /* silencioso */ }
    }

    if (document.body) criarBarraUsuario();
    else document.addEventListener('DOMContentLoaded', criarBarraUsuario);
})();
