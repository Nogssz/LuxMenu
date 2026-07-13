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
        try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* fallback abaixo */ }
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) { return false; }
}

const CAT_ICONES = {
    'Fiscal': '🧾',
    'Financeiro': '💰',
    'Cadastros': '📋',
    'Ordens de Serviço': '🔧',
    'Orçamentos': '📝',
    'Venda/PDV': '🛒',
};

const SUGESTOES = [
    'nota de compra', 'devolução', 'nota fiscal',
    'cadastro de cliente', 'ordem de serviço', 'orçamento', 'PDV', 'PIX',
];

function cardHtml(v) {
    const thumb = thumbUrl(v.url);
    return `
        <div class="vcard">
            ${thumb ? `<img class="vthumb" src="${thumb}" alt="">` : '<div class="vthumb"></div>'}
            <div class="vbody">
                <h2>${escapeHtml(v.titulo)}</h2>
                ${v.descricao ? `<p class="vdesc">${escapeHtml(v.descricao)}</p>` : ''}
                <div class="vactions">
                    <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">▶ assistir</a>
                    <button class="copy" data-url="${escapeHtml(v.url)}">copiar link</button>
                </div>
            </div>
        </div>`;
}

const FLUXO_ETAPAS = [
    { titulos: ['Como criar um orçamento'] },
    { titulos: ['Gerar O.S através de orçamento', 'Criação de ordem de serviço do zero'] },
    { titulos: ['Importar O.S na nota fiscal'] },
];

function fluxoMiniHtml(v) {
    const thumb = thumbUrl(v.url);
    return `
        <div class="fluxo-mini">
            ${thumb ? `<img class="fm-thumb" src="${thumb}" alt="">` : '<div class="fm-thumb"></div>'}
            <div class="fm-body">
                <p class="fm-titulo">${escapeHtml(v.titulo)}</p>
                <div class="fm-actions">
                    <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">assistir</a>
                    <button class="fm-copy" data-url="${escapeHtml(v.url)}">copiar</button>
                </div>
            </div>
        </div>`;
}

function renderFluxo() {
    const porTitulo = Object.fromEntries(todosVideos.map(v => [v.titulo, v]));
    const etapasHtml = FLUXO_ETAPAS.map(etapa => {
        const videos = etapa.titulos.map(t => porTitulo[t]).filter(Boolean);
        if (!videos.length) return null;
        return videos.map((v, i) => (i > 0 ? '<div class="fluxo-ou">ou</div>' : '') + fluxoMiniHtml(v)).join('');
    });

    if (etapasHtml.some(e => e === null)) {
        $('fluxoBox').style.display = 'none';
        return;
    }

    $('fluxoEtapas').innerHTML = etapasHtml
        .map((html, i) => `<div class="fluxo-etapa"><div class="fluxo-num">Etapa ${i + 1}</div>${html}</div>`)
        .join('<div class="fluxo-seta">→</div>');
    $('fluxoBox').style.display = 'block';
}

let todosVideos = [];
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

function renderAgrupado() {
    const grupos = {};
    for (const v of todosVideos) {
        const cat = v.categoria_nome || 'Outros';
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(v);
    }

    const ordem = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    $('lista').innerHTML = ordem.map(cat => `
        <div class="cat-grupo">
            <h2 class="cat-header">${CAT_ICONES[cat] || '📁'} ${escapeHtml(cat)}</h2>
            ${grupos[cat].map(cardHtml).join('')}
        </div>
    `).join('');

    $('empty').style.display = 'none';
}

function renderLista() {
    const busca = $('busca').value.trim();
    document.querySelector('.buscabox').classList.toggle('com-texto', busca.length > 0);

    if (!busca) {
        renderAgrupado();
        return;
    }

    const filtrados = buscarFuse(busca);

    if (!filtrados.length) {
        $('lista').innerHTML = '';
        $('empty').style.display = 'block';
    } else {
        $('empty').style.display = 'none';
        $('lista').innerHTML =
            `<p class="resultado-info">${filtrados.length} vídeo${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}</p>` +
            filtrados.map(cardHtml).join('');
    }
}

// ── Eventos ──

$('lista').addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.copy');
    if (!copyBtn) return;
    const ok = await copiarTexto(copyBtn.dataset.url);
    copyBtn.textContent = ok ? 'copiado ✓' : 'selecione manualmente';
    if (ok) copyBtn.classList.add('ok');
    setTimeout(() => { copyBtn.textContent = 'copiar link'; copyBtn.classList.remove('ok'); }, 1800);
});

$('fluxoEtapas').addEventListener('click', async (e) => {
    const btn = e.target.closest('.fm-copy');
    if (!btn) return;
    const ok = await copiarTexto(btn.dataset.url);
    btn.textContent = ok ? 'copiado ✓' : 'não copiou';
    setTimeout(() => { btn.textContent = 'copiar'; }, 1800);
});

$('sugestoes').addEventListener('click', (e) => {
    const btn = e.target.closest('.sugestao');
    if (!btn) return;
    $('busca').value = btn.textContent;
    renderLista();
    $('busca').focus();
});

$('limpar').addEventListener('click', () => {
    $('busca').value = '';
    renderLista();
});

let debounce;
$('busca').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderLista, 180);
});

// ── Init ──

(async function init() {
    $('sugestoes').innerHTML = SUGESTOES.map(s =>
        `<button class="sugestao">${escapeHtml(s)}</button>`
    ).join('');

    const res = await fetch('videos.json');
    todosVideos = await res.json();
    construirFuse();
    renderAgrupado();
    renderFluxo();
})();
