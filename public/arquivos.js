const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatarTamanho(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatarData(iso) {
    return new Date(iso).toLocaleString('pt-BR');
}

async function api(path, options) {
    const res = await fetch(path, options);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
}

let pastaAtual = null;

async function carregarPastas() {
    const pastas = await api('/api/pastas');
    const grid = $('gridPastas');
    $('emptyPastas').style.display = pastas.length ? 'none' : 'block';
    grid.innerHTML = pastas.map(p => `
        <div class="pastacard" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}">
            <button class="pdel" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}" title="excluir pasta">✕</button>
            <div class="picone">📁</div>
            <h2>${escapeHtml(p.nome)}</h2>
            <div class="pcount">${p.total_arquivos} arquivo(s)</div>
        </div>`).join('');
}

async function abrirPasta(id, nome) {
    pastaAtual = { id, nome };
    $('viewPastas').style.display = 'none';
    $('viewPasta').style.display = '';
    $('pastaTitulo').textContent = nome;
    await carregarArquivos();
}

function voltarParaPastas() {
    pastaAtual = null;
    $('viewPasta').style.display = 'none';
    $('viewPastas').style.display = '';
    carregarPastas();
}

async function carregarArquivos() {
    const arquivos = await api(`/api/arquivos/pasta/${pastaAtual.id}`);
    const tbody = $('tbodyArquivos');
    $('emptyArquivos').style.display = arquivos.length ? 'none' : 'block';
    tbody.innerHTML = arquivos.map(a => `
        <tr>
            <td>${escapeHtml(a.nome_original)}</td>
            <td>${formatarTamanho(a.tamanho)}</td>
            <td>${formatarData(a.criado_em)}</td>
            <td class="acoes">
                <a href="/api/arquivos/${a.id}/download">baixar</a>
                <button class="del" data-id="${a.id}">excluir</button>
            </td>
        </tr>`).join('');
}

$('btnNovaPasta').addEventListener('click', async () => {
    const nome = $('novaPastaNome').value.trim();
    if (!nome) return;
    try {
        await api('/api/pastas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) });
        $('novaPastaNome').value = '';
        carregarPastas();
    } catch (e) { alert(e.message); }
});

$('novaPastaNome').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnNovaPasta').click(); });

$('gridPastas').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.pdel');
    if (delBtn) {
        if (!confirm(`Excluir a pasta "${delBtn.dataset.nome}" e todos os arquivos dentro dela?`)) return;
        await api(`/api/pastas/${delBtn.dataset.id}`, { method: 'DELETE' });
        carregarPastas();
        return;
    }
    const card = e.target.closest('.pastacard');
    if (card) abrirPasta(card.dataset.id, card.dataset.nome);
});

$('voltarPastas').addEventListener('click', (e) => { e.preventDefault(); voltarParaPastas(); });

$('btnExcluirPasta').addEventListener('click', async () => {
    if (!confirm(`Excluir a pasta "${pastaAtual.nome}" e todos os arquivos dentro dela?`)) return;
    await api(`/api/pastas/${pastaAtual.id}`, { method: 'DELETE' });
    voltarParaPastas();
});

$('btnEnviar').addEventListener('click', async () => {
    const arquivo = $('inputArquivo').files[0];
    if (!arquivo) { alert('Escolha um arquivo primeiro.'); return; }

    const formData = new FormData();
    formData.append('arquivo', arquivo);

    $('progresso').classList.add('show');
    $('btnEnviar').disabled = true;
    try {
        await api(`/api/arquivos/pasta/${pastaAtual.id}`, { method: 'POST', body: formData });
        $('inputArquivo').value = '';
        await carregarArquivos();
        await carregarPastas();
    } catch (e) {
        alert(e.message);
    } finally {
        $('progresso').classList.remove('show');
        $('btnEnviar').disabled = false;
    }
});

$('tbodyArquivos').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.del');
    if (!delBtn) return;
    if (!confirm('Excluir esse arquivo?')) return;
    await api(`/api/arquivos/${delBtn.dataset.id}`, { method: 'DELETE' });
    carregarArquivos();
});

carregarPastas();
