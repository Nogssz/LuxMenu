import Fuse from './fuse.min.mjs';

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

async function api(path, options) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
}

function renderTags(tags) {
    if (!tags) return '';
    return tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span>${escapeHtml(t)}</span>`).join('');
}

function cardEditHtml(v) {
    const opts = categorias.map(c =>
        `<option value="${c.id}"${Number(v.categoria_id) === c.id ? ' selected' : ''}>${escapeHtml(c.nome)}</option>`
    ).join('');
    return `
        <div class="vedit">
            <div class="row2">
                <input class="ei-titulo" placeholder="Título" value="${escapeHtml(v.titulo)}">
                <input class="ei-url" placeholder="Link do YouTube" value="${escapeHtml(v.url)}">
            </div>
            <div class="row2">
                <input class="ei-tags" placeholder="Palavras-chave separadas por vírgula" value="${escapeHtml(v.tags || '')}">
                <select class="ei-categoria">
                    <option value="">Sem categoria</option>
                    ${opts}
                </select>
            </div>
            <input class="ei-descricao" placeholder="Descrição (opcional)" value="${escapeHtml(v.descricao || '')}" style="width:100%;margin-bottom:8px">
            <div class="vedit-actions">
                <button class="btn ei-salvar" data-id="${v.id}">Salvar</button>
                <button class="btn cancelar ei-cancelar" data-id="${v.id}">Cancelar</button>
            </div>
        </div>`;
}

function cardHtml(v) {
    const thumb = thumbUrl(v.url);
    return `
        <div class="vcard" data-id="${v.id}">
            ${thumb ? `<img class="vthumb" src="${thumb}" alt="">` : '<div class="vthumb"></div>'}
            <div class="vbody">
                ${v.categoria_nome ? `<div class="vcategoria">${escapeHtml(v.categoria_nome)}</div>` : ''}
                <h2>${escapeHtml(v.titulo)}</h2>
                ${v.descricao ? `<p class="vdesc">${escapeHtml(v.descricao)}</p>` : ''}
                <div class="vtags">${renderTags(v.tags)}</div>
                <div class="vactions">
                    <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">abrir</a>
                    <button class="copy" data-url="${escapeHtml(v.url)}">copiar link</button>
                    <button class="edit" data-id="${v.id}">editar</button>
                    <button class="del" data-id="${v.id}">excluir</button>
                </div>
            </div>
        </div>`;
}

let todosVideos = [];
let categorias = [];
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

function buscarFuse(busca) {
    let resultados = fuseIndex.search(busca).map(r => r.item);
    const palavras = busca.split(/\s+/).filter(p => p.length >= 3);
    if (resultados.length < 2 && palavras.length > 1) {
        // Pontua cada vídeo pelo número de palavras que ele acerta; mais palavras = aparece primeiro
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

function renderFiltrado() {
    const busca = $('busca').value.trim();
    let resultados;

    if (busca.length >= 2 && fuseIndex) {
        resultados = buscarFuse(busca);
    } else {
        resultados = [...todosVideos];
    }

    if (categoriaFiltro) {
        resultados = resultados.filter(v => String(v.categoria_id) === categoriaFiltro);
    }

    if (!resultados.length) {
        $('lista').innerHTML = '';
        $('empty').style.display = 'block';
    } else {
        $('empty').style.display = 'none';
        $('lista').innerHTML = resultados.map(cardHtml).join('');
    }
}

async function carregarTodos() {
    todosVideos = await api('/api/videos');
    construirFuse();
    renderFiltrado();
}

async function carregarCategorias() {
    categorias = await api('/api/categorias-video');

    $('catchips').innerHTML = ['<button class="catchip active" data-id="">Todas</button>']
        .concat(categorias.map(c => `<button class="catchip" data-id="${c.id}">${escapeHtml(c.nome)}</button>`))
        .join('');

    $('vCategoria').innerHTML = '<option value="">Sem categoria</option>' +
        categorias.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
}

function resetForm() {
    $('videoId').value = '';
    $('vTitulo').value = '';
    $('vUrl').value = '';
    $('vTags').value = '';
    $('vDescricao').value = '';
    $('vCategoria').value = '';
    $('formTitulo').textContent = 'Novo vídeo';
    $('btnCancelar').style.display = 'none';
}

$('toggleAdmin').addEventListener('click', () => {
    const admin = $('admin');
    const abrindo = !admin.classList.contains('show');
    admin.classList.toggle('show');
    if (abrindo) resetForm();
});

$('btnCancelar').addEventListener('click', () => { resetForm(); $('admin').classList.remove('show'); });

$('btnNovaCategoria').addEventListener('click', async () => {
    const nome = $('novaCategoria').value.trim();
    if (!nome) return;
    const categoria = await api('/api/categorias-video', { method: 'POST', body: JSON.stringify({ nome }) });
    $('novaCategoria').value = '';
    await carregarCategorias();
    $('vCategoria').value = categoria.id;
});

$('btnSalvar').addEventListener('click', async () => {
    const titulo = $('vTitulo').value.trim();
    const url = $('vUrl').value.trim();
    if (!titulo || !url) { alert('Título e link são obrigatórios.'); return; }

    const payload = {
        titulo, url,
        tags: $('vTags').value.trim(),
        descricao: $('vDescricao').value.trim(),
        categoria_id: $('vCategoria').value || null,
    };
    try {
        await api('/api/videos', { method: 'POST', body: JSON.stringify(payload) });
        resetForm();
        $('admin').classList.remove('show');
        await carregarTodos();
    } catch (e) { alert(e.message); }
});

$('lista').addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.copy');
    const editBtn = e.target.closest('.edit');
    const delBtn = e.target.closest('.del');
    const salvarBtn = e.target.closest('.ei-salvar');
    const cancelarBtn = e.target.closest('.ei-cancelar');

    if (copyBtn) {
        const ok = await copiarTexto(copyBtn.dataset.url);
        copyBtn.textContent = ok ? 'copiado ✓' : 'não copiou, selecione manualmente';
        if (ok) copyBtn.classList.add('ok');
        setTimeout(() => { copyBtn.textContent = 'copiar link'; copyBtn.classList.remove('ok'); }, 1800);
        return;
    }

    if (editBtn) {
        const id = Number(editBtn.dataset.id);
        const video = todosVideos.find(v => v.id === id);
        if (!video) return;
        const card = $('lista').querySelector(`.vcard[data-id="${id}"]`);
        if (card) { card.innerHTML = cardEditHtml(video); card.classList.add('editando'); }
        return;
    }

    if (salvarBtn) {
        const id = Number(salvarBtn.dataset.id);
        const card = $('lista').querySelector(`.vcard[data-id="${id}"]`);
        if (!card) return;
        const titulo = card.querySelector('.ei-titulo').value.trim();
        const url = card.querySelector('.ei-url').value.trim();
        if (!titulo || !url) { alert('Título e link são obrigatórios.'); return; }
        const payload = {
            titulo, url,
            tags: card.querySelector('.ei-tags').value.trim(),
            descricao: card.querySelector('.ei-descricao').value.trim(),
            categoria_id: card.querySelector('.ei-categoria').value || null,
        };
        try {
            const updated = await api(`/api/videos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            const cat = categorias.find(c => String(c.id) === String(payload.categoria_id));
            const novoVideo = { ...updated, categoria_nome: cat?.nome || null };
            const idx = todosVideos.findIndex(v => v.id === id);
            if (idx !== -1) { todosVideos[idx] = novoVideo; construirFuse(); }
            card.outerHTML = cardHtml(novoVideo);
        } catch (err) { alert(err.message); }
        return;
    }

    if (cancelarBtn) {
        const id = Number(cancelarBtn.dataset.id);
        const video = todosVideos.find(v => v.id === id);
        const card = $('lista').querySelector(`.vcard[data-id="${id}"]`);
        if (video && card) card.outerHTML = cardHtml(video);
        return;
    }

    if (delBtn) {
        if (!confirm('Excluir esse vídeo da lista?')) return;
        await api(`/api/videos/${delBtn.dataset.id}`, { method: 'DELETE' });
        await carregarTodos();
    }
});

$('catchips').addEventListener('click', (e) => {
    const btn = e.target.closest('.catchip');
    if (!btn) return;
    $('catchips').querySelectorAll('.catchip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    categoriaFiltro = btn.dataset.id;
    renderFiltrado();
});

let debounce;
$('busca').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(renderFiltrado, 150);
});

(async function init() {
    await carregarCategorias();
    await carregarTodos();
})();
