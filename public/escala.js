const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatarDataBR(iso) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function api(path, options) {
    const res = await fetch(path, options);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
}

let sabados = [];
let pessoas = [];
let editando = null; // { data, modo: 'reatribuir' | 'trocar' }

async function carregar() {
    [sabados, pessoas] = await Promise.all([
        api('/api/escala/sabados?proximos=10'),
        api('/api/escala/pessoas'),
    ]);
    renderEscala();
    renderPessoas();
}

function renderForm(s) {
    if (editando.modo === 'reatribuir') {
        const opcoesPessoas = pessoas.filter(p => p.ativo || p.id === s.pessoa_id)
            .map(p => `<option value="${p.id}" ${p.id === s.pessoa_id ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('');
        return `
            <div class="form-inline">
                <select id="selPessoaReatribuir">${opcoesPessoas}</select>
                <input type="text" id="inputObservacao" placeholder="motivo (opcional)" value="${escapeHtml(s.observacao || '')}">
                <button class="btn" id="btnSalvarReatribuir">Salvar</button>
                <button class="btn secundario" id="btnCancelarEdicao">Cancelar</button>
            </div>`;
    }

    const hoje = hojeISO();
    const outras = sabados.filter(o => o.data !== s.data && o.data >= hoje);
    const opcoesDatas = outras.map(o => `<option value="${o.data}">${formatarDataBR(o.data)} — ${escapeHtml(o.pessoa_nome)}</option>`).join('');
    return `
        <div class="form-inline">
            <span>Trocar com:</span>
            <select id="selDataTrocar">${opcoesDatas || '<option disabled>nenhum outro sábado futuro</option>'}</select>
            <button class="btn" id="btnSalvarTrocar" ${outras.length ? '' : 'disabled'}>Confirmar troca</button>
            <button class="btn secundario" id="btnCancelarEdicao">Cancelar</button>
        </div>`;
}

function renderEscala() {
    const hoje = hojeISO();
    let primeiraFutura = true;

    $('tbodyEscala').innerHTML = sabados.map(s => {
        const passada = s.data < hoje;
        let classe = '';
        if (passada) classe = 'passada';
        else if (primeiraFutura) { classe = 'proxima'; primeiraFutura = false; }

        const badge = s.manual
            ? `<span class="badge-manual" title="${escapeHtml(s.observacao || 'ajustado manualmente')}">ajustado</span>`
            : '';

        const acoes = passada ? '' : `
            <button class="btn-reatribuir" data-data="${s.data}">Reatribuir</button>
            <button class="btn-trocar" data-data="${s.data}">Trocar</button>`;

        const linhaForm = (editando && editando.data === s.data)
            ? `<tr class="${classe}"><td colspan="3">${renderForm(s)}</td></tr>`
            : '';

        return `<tr class="${classe}">
                <td>${formatarDataBR(s.data)}</td>
                <td><span class="pessoa">${escapeHtml(s.pessoa_nome)}</span>${badge}</td>
                <td class="acoes">${acoes}</td>
            </tr>${linhaForm}`;
    }).join('');
}

function renderPessoas() {
    $('listaPessoas').innerHTML = pessoas.map(p => `
        <div class="pessoa-linha ${p.ativo ? '' : 'inativa'}">
            <span><span class="ordem">${p.ordem}</span>${escapeHtml(p.nome)}</span>
            <label class="switch">
                <input type="checkbox" data-id="${p.id}" ${p.ativo ? 'checked' : ''}> ativo no rodízio
            </label>
        </div>`).join('');
}

$('tbodyEscala').addEventListener('click', async (e) => {
    const btnReatribuir = e.target.closest('.btn-reatribuir');
    const btnTrocar = e.target.closest('.btn-trocar');
    const btnCancelar = e.target.closest('#btnCancelarEdicao');
    const btnSalvarReatribuir = e.target.closest('#btnSalvarReatribuir');
    const btnSalvarTrocar = e.target.closest('#btnSalvarTrocar');

    if (btnReatribuir) { editando = { data: btnReatribuir.dataset.data, modo: 'reatribuir' }; renderEscala(); return; }
    if (btnTrocar) { editando = { data: btnTrocar.dataset.data, modo: 'trocar' }; renderEscala(); return; }
    if (btnCancelar) { editando = null; renderEscala(); return; }

    if (btnSalvarReatribuir) {
        const pessoa_id = Number($('selPessoaReatribuir').value);
        const observacao = $('inputObservacao').value;
        try {
            await api(`/api/escala/sabados/${editando.data}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pessoa_id, observacao }),
            });
            editando = null;
            await carregar();
        } catch (err) { alert(err.message); }
        return;
    }

    if (btnSalvarTrocar) {
        const data_b = $('selDataTrocar').value;
        try {
            await api('/api/escala/sabados/trocar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data_a: editando.data, data_b }),
            });
            editando = null;
            await carregar();
        } catch (err) { alert(err.message); }
        return;
    }
});

$('listaPessoas').addEventListener('change', async (e) => {
    const chk = e.target.closest('input[type="checkbox"]');
    if (!chk) return;
    try {
        await api(`/api/escala/pessoas/${chk.dataset.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: chk.checked }),
        });
        await carregar();
    } catch (err) {
        alert(err.message);
        chk.checked = !chk.checked;
    }
});

carregar();

// Atualiza a lista periodicamente pra refletir mudanças feitas por outras pessoas,
// sem recarregar a página. Pula o ciclo se a aba estiver em segundo plano ou se
// houver uma edição (troca/reatribuição) em aberto, pra não interromper quem está digitando.
setInterval(() => {
    if (document.hidden || editando) return;
    carregar();
}, 10000);
