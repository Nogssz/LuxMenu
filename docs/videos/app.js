import Fuse from 'https://cdn.jsdelivr.net/npm/fuse.js@7/dist/fuse.min.mjs';

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function extrairIdYoutube(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
    return m ? m[1] : null;
}

function thumbUrl(url) {
    const id = extrairIdYoutube(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

async function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* cai no fallback abaixo */ }
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
    } catch (e) { return false; }
}

function renderTags(tags) {
    if (!tags) return '';
    return tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span>${escapeHtml(t)}</span>`).join('');
}

function cardHtml(v) {
    const thumb = thumbUrl(v.url);
    return `
        <div class="vcard">
            ${thumb ? `<img class="vthumb" src="${thumb}" alt="">` : '<div class="vthumb"></div>'}
            <div class="vbody">
                ${v.categoria_nome ? `<div class="vcategoria">${escapeHtml(v.categoria_nome)}</div>` : ''}
                <h2>${escapeHtml(v.titulo)}</h2>
                ${v.descricao ? `<p class="vdesc">${escapeHtml(v.descricao)}</p>` : ''}
                <div class="vtags">${renderTags(v.tags)}</div>
                <div class="vactions">
                    <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">assistir</a>
                    <button class="copy" data-url="${escapeHtml(v.url)}">copiar link</button>
                </div>
            </div>
        </div>`;
}

let todosVideos = [];
let categoriaFiltro = '';
let fuseIndex = null;

function construirFuse() {
    fuseIndex = new Fuse(todosVideos, {
        keys: [
            { name: 'titulo', weight: 3 },
            { name: 'tags', weight: 2 },
            { name: 'categoria_nome', weight: 1 },
            { name: 'descricao', weight: 0.5 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
        shouldSort: true,
    });
}

function categoriasUnicas() {
    const nomes = [...new Set(todosVideos.map(v => v.categoria_nome).filter(Boolean))];
    return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function renderCatchips() {
    $('catchips').innerHTML = ['<button class="catchip active" data-nome="">Todas</button>']
        .concat(categoriasUnicas().map(nome => `<button class="catchip" data-nome="${escapeHtml(nome)}">${escapeHtml(nome)}</button>`))
        .join('');
}

function buscarFuse(busca) {
    let resultados = fuseIndex.search(busca).map(r => r.item);
    const palavras = busca.split(/\s+/).filter(p => p.length >= 3);
    if (resultados.length < 2 && palavras.length > 1) {
        const pontos = new Map();
        for (const p of palavras) {
            for (const { item } of fuseIndex.search(p)) {
                pontos.set(item.id, (pontos.get(item.id) || 0) + 1);
            }
        }
        const porId = Object.fromEntries(todosVideos.map(v => [v.id, v]));
        resultados = [...pontos.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => porId[id])
            .filter(Boolean);
    }
    return resultados;
}

function renderLista() {
    const busca = $('busca').value.trim();
    let filtrados;

    if (busca.length >= 2 && fuseIndex) {
        filtrados = buscarFuse(busca);
    } else {
        filtrados = [...todosVideos];
    }

    if (categoriaFiltro) {
        filtrados = filtrados.filter(v => v.categoria_nome === categoriaFiltro);
    }

    const lista = $('lista');
    const empty = $('empty');
    if (!filtrados.length) {
        lista.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        lista.innerHTML = filtrados.map(cardHtml).join('');
    }
}

$('lista').addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.copy');
    if (!copyBtn) return;
    const ok = await copiarTexto(copyBtn.dataset.url);
    copyBtn.textContent = ok ? 'copiado ✓' : 'não copiou, selecione manualmente';
    if (ok) copyBtn.classList.add('ok');
    setTimeout(() => { copyBtn.textContent = 'copiar link'; copyBtn.classList.remove('ok'); }, 1800);
});

$('catchips').addEventListener('click', (e) => {
    const btn = e.target.closest('.catchip');
    if (!btn) return;
    $('catchips').querySelectorAll('.catchip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    categoriaFiltro = btn.dataset.nome;
    renderLista();
});

let debounce;
$('busca').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderLista, 200);
});

(async function init() {
    const res = await fetch('videos.json');
    todosVideos = await res.json();
    construirFuse();
    renderCatchips();
    renderLista();
})();
