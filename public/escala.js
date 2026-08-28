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
    const outras = sabados.filter(o => o.data !== s.data && o.data >= hoje && !o.folga);
    const opcoesDatas = outras.map(o => `<option value="${o.data}">${formatarDataBR(o.data)} — ${escapeHtml(o.pessoa_nome)}</option>`).join('');
    return `
        <div class="form-inline">
            <span>Trocar com:</span>
            <select id="selDataTrocar">${opcoesDatas || '<option disabled>nenhum outro sábado futuro disponível</option>'}</select>
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
        if (s.folga) classe = 'folga';
        else if (passada) classe = 'passada';
        else if (primeiraFutura) { classe = 'proxima'; primeiraFutura = false; }

        let nomeDisplay;
        if (s.folga) {
            nomeDisplay = `<span class="badge-folga">sem expediente</span>`;
        } else {
            const badge = s.manual
                ? `<span class="badge-manual" title="${escapeHtml(s.observacao || 'ajustado manualmente')}">ajustado</span>`
                : '';
            nomeDisplay = `<span class="pessoa">${escapeHtml(s.pessoa_nome)}</span>${badge}`;
        }

        let acoes = '';
        if (!passada) {
            if (s.folga) {
                acoes = `<button class="btn-despular" data-data="${s.data}">Retomar</button>`;
            } else {
                acoes = `
                    <button class="btn-reatribuir" data-data="${s.data}">Reatribuir</button>
                    <button class="btn-trocar" data-data="${s.data}">Trocar</button>
                    <button class="btn-pular" data-data="${s.data}">Pular</button>`;
            }
        }

        const linhaForm = (editando && editando.data === s.data)
            ? `<tr class="${classe}"><td colspan="3">${renderForm(s)}</td></tr>`
            : '';

        return `<tr class="${classe}">
                <td>${formatarDataBR(s.data)}</td>
                <td>${nomeDisplay}</td>
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
    const btnPular = e.target.closest('.btn-pular');
    const btnDespular = e.target.closest('.btn-despular');
    const btnCancelar = e.target.closest('#btnCancelarEdicao');
    const btnSalvarReatribuir = e.target.closest('#btnSalvarReatribuir');
    const btnSalvarTrocar = e.target.closest('#btnSalvarTrocar');

    if (btnReatribuir) { editando = { data: btnReatribuir.dataset.data, modo: 'reatribuir' }; renderEscala(); return; }
    if (btnTrocar) { editando = { data: btnTrocar.dataset.data, modo: 'trocar' }; renderEscala(); return; }
    if (btnCancelar) { editando = null; renderEscala(); return; }

    if (btnPular) {
        const data = btnPular.dataset.data;
        const s = sabados.find(x => x.data === data);
        if (!confirm(`Pular ${formatarDataBR(data)}? A vez de ${escapeHtml(s.pessoa_nome)} passa para o sábado seguinte.`)) return;
        try {
            await api('/api/escala/sabados/pular', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });
            await carregar();
        } catch (err) { alert(err.message); }
        return;
    }

    if (btnDespular) {
        const data = btnDespular.dataset.data;
        if (!confirm(`Retomar ${formatarDataBR(data)} como sábado normal?`)) return;
        try {
            await api('/api/escala/sabados/despular', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data }),
            });
            await carregar();
        } catch (err) { alert(err.message); }
        return;
    }

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

setInterval(() => {
    if (document.hidden || editando) return;
    carregar();
}, 10000);
