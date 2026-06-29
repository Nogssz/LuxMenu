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
