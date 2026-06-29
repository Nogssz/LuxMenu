const $ = (id) => document.getElementById(id);

const state = {
    mes: null,
    ano: null,
    busca: '',
    contabilidade_id: '',
    feito: '',
    campos: [],
    contabilidades: [],
};

function monthInputValue(mes, ano) {
    return `${ano}-${String(mes).padStart(2, '0')}`;
}

function initMes() {
    const now = new Date();
    state.mes = now.getMonth() + 1;
    state.ano = now.getFullYear();
    $('mesAno').value = monthInputValue(state.mes, state.ano);
}

async function api(path, options) {
    const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
}

async function loadContabilidades() {
    state.contabilidades = await api('/api/contabilidades');

    const filtro = $('filtroContabilidade');
    const novoCliente = $('novoClienteContab');
    filtro.innerHTML = '<option value="">Todas as contabilidades</option>';
    novoCliente.innerHTML = '<option value="">Sem contabilidade</option>';
    for (const c of state.contabilidades) {
        filtro.insertAdjacentHTML('beforeend', `<option value="${c.id}">${escapeHtml(c.nome)}</option>`);
        novoCliente.insertAdjacentHTML('beforeend', `<option value="${c.id}">${escapeHtml(c.nome)}</option>`);
    }

    $('listaContabs').innerHTML = state.contabilidades.map(c => `<span>${escapeHtml(c.nome)}</span>`).join('') || '<span class="muted">nenhuma cadastrada</span>';
}

async function loadCampos() {
    state.campos = await api('/api/campos');

    const thead = $('theadRow');
    thead.querySelectorAll('th.campo-th').forEach(th => th.remove());
    const feitoTh = thead.querySelector('.feito-col');
    for (const campo of state.campos) {
        const th = document.createElement('th');
        th.className = 'campo-th';
        th.textContent = campo.nome;
        thead.insertBefore(th, feitoTh);
    }

    $('listaCampos').innerHTML = state.campos.map(c => `<span>${escapeHtml(c.nome)} · ${c.tipo}</span>`).join('') || '<span class="muted">nenhuma coluna customizada</span>';
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function campoInputHtml(campo, clienteId, valorAtual) {
    const val = valorAtual ?? '';
    if (campo.tipo === 'checkbox') {
        const checked = val === '1' || val === 'true' ? 'checked' : '';
        return `<input type="checkbox" class="feito-check campo-valor" data-cliente="${clienteId}" data-campo="${campo.id}" ${checked}>`;
    }
    if (campo.tipo === 'selecao') {
        const opcoes = (campo.opcoes || []).map(o => `<option value="${escapeHtml(o.valor)}" ${o.valor === val ? 'selected' : ''}>${escapeHtml(o.valor)}</option>`).join('');
        return `<select class="campo-input campo-valor" data-cliente="${clienteId}" data-campo="${campo.id}"><option value="">—</option>${opcoes}</select>`;
    }
    return `<input type="text" class="campo-input campo-valor" data-cliente="${clienteId}" data-campo="${campo.id}" value="${escapeHtml(val)}">`;
}

async function loadFechamentos() {
    const params = new URLSearchParams({ mes: state.mes, ano: state.ano });
    if (state.busca) params.set('busca', state.busca);
    if (state.contabilidade_id) params.set('contabilidade_id', state.contabilidade_id);
    if (state.feito !== '') params.set('feito', state.feito);

    const clientes = await api(`/api/fechamentos?${params.toString()}`);
    renderTable(clientes);
}

function renderTable(clientes) {
    const tbody = $('tbody');
    const empty = $('empty');

    if (!clientes.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        tbody.innerHTML = clientes.map(c => `
            <tr>
                <td class="nome">${escapeHtml(c.nome)}${c.cnpj ? `<br><span class="muted">${escapeHtml(c.cnpj)}</span>` : ''}</td>
                <td>${c.contabilidade_nome ? escapeHtml(c.contabilidade_nome) : '<span class="muted">—</span>'}</td>
                <td>${c.responsavel ? escapeHtml(c.responsavel) : ''}${c.contato ? `<br><span class="muted">${escapeHtml(c.contato)}</span>` : ''}</td>
                ${state.campos.map(campo => `<td>${campoInputHtml(campo, c.id, c.valores[campo.id])}</td>`).join('')}
                <td class="feito-col"><input type="checkbox" class="feito-check" data-cliente="${c.id}" ${c.feito ? 'checked' : ''}></td>
            </tr>
        `).join('');
    }

    const total = clientes.length;
    const feitos = clientes.filter(c => c.feito).length;
    $('summary').innerHTML = `<b>${feitos}</b> de <b>${total}</b> clientes com envio marcado como feito em ${String(state.mes).padStart(2, '0')}/${state.ano}.`;
}

async function onFeitoCheck(e) {
    const checkbox = e.target;
    const clienteId = Number(checkbox.dataset.cliente);
    await api('/api/fechamentos', {
        method: 'PUT',
        body: JSON.stringify({ cliente_id: clienteId, mes: state.mes, ano: state.ano, feito: checkbox.checked }),
    });
    loadFechamentos();
}

async function onCampoValorChange(e) {
    const el = e.target;
    const clienteId = el.dataset.cliente;
    const campoId = el.dataset.campo;
    const valor = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
    await api(`/api/clientes/${clienteId}/campos/${campoId}`, {
        method: 'PUT',
        body: JSON.stringify({ valor }),
    });
}

function bindTableEvents() {
    $('tbody').addEventListener('change', (e) => {
        if (e.target.matches('.feito-check:not(.campo-valor)')) onFeitoCheck(e);
        else if (e.target.matches('.campo-valor')) onCampoValorChange(e);
    });
}

function bindFilters() {
    $('mesAno').addEventListener('change', (e) => {
        const [ano, mes] = e.target.value.split('-').map(Number);
        state.ano = ano; state.mes = mes;
        loadFechamentos();
    });

    let debounce;
    $('busca').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => { state.busca = e.target.value.trim(); loadFechamentos(); }, 300);
    });

    $('filtroContabilidade').addEventListener('change', (e) => {
        state.contabilidade_id = e.target.value;
        loadFechamentos();
    });

    $('filtroFeito').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        $('filtroFeito').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.feito = btn.dataset.val;
        loadFechamentos();
    });
}

function bindAdmin() {
    $('toggleAdmin').addEventListener('click', () => $('admin').classList.toggle('show'));

    $('novoCampoTipo').addEventListener('change', (e) => {
        $('novoCampoOpcoes').style.display = e.target.value === 'selecao' ? '' : 'none';
    });

    $('btnAddContab').addEventListener('click', async () => {
        const nome = $('novaContabNome').value.trim();
        if (!nome) return;
        await api('/api/contabilidades', { method: 'POST', body: JSON.stringify({ nome, email: $('novaContabEmail').value.trim() || null }) });
        $('novaContabNome').value = ''; $('novaContabEmail').value = '';
        await loadContabilidades();
    });

    $('btnAddCampo').addEventListener('click', async () => {
        const nome = $('novoCampoNome').value.trim();
        const tipo = $('novoCampoTipo').value;
        if (!nome) return;
        const opcoes = tipo === 'selecao' ? $('novoCampoOpcoes').value.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        await api('/api/campos', { method: 'POST', body: JSON.stringify({ nome, tipo, opcoes }) });
        $('novoCampoNome').value = ''; $('novoCampoOpcoes').value = '';
        await loadCampos();
        await loadFechamentos();
    });

    $('btnAddCliente').addEventListener('click', async () => {
        const nome = $('novoClienteNome').value.trim();
        if (!nome) return;
        await api('/api/clientes', {
            method: 'POST',
            body: JSON.stringify({
                nome,
                cnpj: $('novoClienteCnpj').value.trim() || null,
                responsavel: $('novoClienteResp').value.trim() || null,
                contato: $('novoClienteContato').value.trim() || null,
                obs: $('novoClienteObs').value.trim() || null,
                contabilidade_id: $('novoClienteContab').value || null,
            }),
        });
        ['novoClienteNome', 'novoClienteCnpj', 'novoClienteResp', 'novoClienteContato', 'novoClienteObs'].forEach(id => $(id).value = '');
        $('novoClienteContab').value = '';
        await loadFechamentos();
    });
}

async function init() {
    initMes();
    bindTableEvents();
    bindFilters();
    bindAdmin();
    await loadContabilidades();
    await loadCampos();
    await loadFechamentos();
}

init();
