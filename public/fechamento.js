const $ = (id) => document.getElementById(id);

const state = {
    mes: null,
    ano: null,
    busca: '',
    contabilidade_nome: '',
    feito: '',
    campos: [],
    contabilidades: [],
};

let clientesAtivos = [];
let wsFech = null;

function monthInputValue(mes, ano) {
    return `${ano}-${String(mes).padStart(2, '0')}`;
}

const FILTROS_KEY = 'luxmenu-fechamento-filtros';

function salvarFiltros() {
    localStorage.setItem(FILTROS_KEY, JSON.stringify({
        mes: state.mes, ano: state.ano,
        busca: state.busca,
        contabilidade_nome: state.contabilidade_nome,
        feito: state.feito,
    }));
}

function initMes() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(FILTROS_KEY) || '{}'); } catch {}

    const now = new Date();
    state.mes  = saved.mes  || now.getMonth() + 1;
    state.ano  = saved.ano  || now.getFullYear();
    state.busca             = saved.busca             || '';
    state.contabilidade_nome = saved.contabilidade_nome || '';
    state.feito             = saved.feito             ?? '';

    $('mesAno').value = monthInputValue(state.mes, state.ano);
    if (state.busca)             $('busca').value = state.busca;
    if (state.contabilidade_nome) $('filtroContabilidade').value = state.contabilidade_nome;

    // Restaura botão ativo do filtro feito
    $('filtroFeito').querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === state.feito);
    });
}

function esconderLinha(clienteId) {
    const tr = document.querySelector(`tr[data-cliente="${clienteId}"]`);
    if (!tr) return;
    tr.style.transition = 'opacity .25s';
    tr.style.opacity = '0';
    setTimeout(() => {
        tr.remove();
        clientesAtivos = clientesAtivos.filter(x => x.id !== clienteId);
        renderSummary();
    }, 250);
}

function deveEsconder(feito) {
    return (state.feito === '0' && feito) || (state.feito === '1' && !feito);
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

    // Autocomplete do filtro de busca
    $('contabSugest').innerHTML = state.contabilidades
        .map(c => `<option value="${escapeHtml(c.nome)}">`)
        .join('');

    // Select do formulário de novo cliente
    const novoCliente = $('novoClienteContab');
    novoCliente.innerHTML = '<option value="">Sem contabilidade</option>';
    for (const c of state.contabilidades) {
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
    if (state.contabilidade_nome) params.set('contabilidade_nome', state.contabilidade_nome);
    if (state.feito !== '') params.set('feito', state.feito);

    const clientes = await api(`/api/fechamentos?${params.toString()}`);
    renderTable(clientes);
}

function renderSummary() {
    const total    = clientesAtivos.length;
    const feitos   = clientesAtivos.filter(c => c.feito).length;
    const chamados = clientesAtivos.filter(c => c.chamado && !c.feito).length;
    $('summary').innerHTML = `<b>${feitos}</b> de <b>${total}</b> feitos em ${String(state.mes).padStart(2, '0')}/${state.ano}`
        + (chamados ? ` · <b>${chamados}</b> chamado${chamados > 1 ? 's' : ''} aguardando` : '') + '.';
}

function renderTable(clientes) {
    clientesAtivos = clientes;
    const tbody = $('tbody');
    const empty = $('empty');

    if (!clientes.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        tbody.innerHTML = clientes.map(c => `
            <tr data-cliente="${c.id}">
                <td class="nome">${escapeHtml(c.nome)}${c.cnpj ? `<br><span class="muted">${escapeHtml(c.cnpj)}</span>` : ''}</td>
                <td>${c.contabilidade_nome ? escapeHtml(c.contabilidade_nome) : '<span class="muted">—</span>'}</td>
                <td>${c.responsavel ? escapeHtml(c.responsavel) : ''}${c.contato ? `<br><span class="muted">${escapeHtml(c.contato)}</span>` : ''}</td>
                ${state.campos.map(campo => `<td>${campoInputHtml(campo, c.id, c.valores[campo.id])}</td>`).join('')}
                <td class="feito-col"><input type="checkbox" class="chamado-check" data-cliente="${c.id}" ${c.chamado ? 'checked' : ''}></td>
                <td class="feito-col"><input type="checkbox" class="feito-check" data-cliente="${c.id}" ${c.feito ? 'checked' : ''}></td>
            </tr>
        `).join('');
    }

    renderSummary();
}

function aplicarAtualizacao(dados) {
    if (dados.mes !== state.mes || dados.ano !== state.ano) return;

    const c = clientesAtivos.find(x => x.id === dados.cliente_id);
    if (c) { c.feito = dados.feito; c.chamado = dados.chamado; }

    if (deveEsconder(dados.feito)) {
        esconderLinha(dados.cliente_id);
        return;
    }

    const tr = document.querySelector(`tr[data-cliente="${dados.cliente_id}"]`);
    if (tr) {
        const chk = tr.querySelector('.chamado-check');
        const fto = tr.querySelector('.feito-check:not(.campo-valor)');
        if (chk) chk.checked = dados.chamado;
        if (fto) fto.checked = dados.feito;
    }

    renderSummary();
}

async function onFeitoCheck(e) {
    const checkbox = e.target;
    const clienteId = Number(checkbox.dataset.cliente);
    const c = clientesAtivos.find(x => x.id === clienteId);
    const anterior = c?.feito;
    if (c) { c.feito = checkbox.checked; renderSummary(); }

    if (deveEsconder(checkbox.checked)) {
        esconderLinha(clienteId);
    }

    try {
        await api('/api/fechamentos', {
            method: 'PUT',
            body: JSON.stringify({ cliente_id: clienteId, mes: state.mes, ano: state.ano, feito: checkbox.checked }),
        });
    } catch {
        if (c) { c.feito = anterior; renderSummary(); }
        // Reinsere a linha recarregando (caso raro de erro de rede)
        loadFechamentos();
    }
}

async function onChamadoCheck(e) {
    const checkbox = e.target;
    const clienteId = Number(checkbox.dataset.cliente);
    const c = clientesAtivos.find(x => x.id === clienteId);
    const anterior = c?.chamado;
    if (c) { c.chamado = checkbox.checked; renderSummary(); }
    try {
        await api('/api/fechamentos', {
            method: 'PUT',
            body: JSON.stringify({ cliente_id: clienteId, mes: state.mes, ano: state.ano, chamado: checkbox.checked }),
        });
    } catch {
        if (c) { c.chamado = anterior; renderSummary(); }
        checkbox.checked = anterior;
    }
}

function conectarWsFechamento() {
    if (wsFech && wsFech.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    wsFech = new WebSocket(`${proto}://${location.host}/fechamento/ws`);
    wsFech.addEventListener('message', (e) => {
        const dados = JSON.parse(e.data);
        if (dados.tipo === 'atualizar') aplicarAtualizacao(dados);
    });
    wsFech.addEventListener('close', () => setTimeout(conectarWsFechamento, 3000));
}

async function loadClientesAdmin() {
    const clientes = await api('/api/clientes');
    const el = $('listaClientesAdmin');
    if (!clientes.length) {
        el.innerHTML = '<span class="muted" style="font-size:12.5px">nenhum cliente cadastrado</span>';
        return;
    }
    el.innerHTML = clientes.map(c => `
        <div class="cliente-admin-row">
            <span class="cliente-admin-nome">${escapeHtml(c.nome)}${c.cnpj ? ` <span class="muted">· ${escapeHtml(c.cnpj)}</span>` : ''}</span>
            <button class="btn-perigo" data-id="${c.id}" data-nome="${escapeHtml(c.nome)}">Excluir</button>
        </div>
    `).join('');
    el.querySelectorAll('.btn-perigo').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(`Excluir "${btn.dataset.nome}" permanentemente?\n\nTodo o histórico de fechamentos também será removido. Essa ação não pode ser desfeita.`)) return;
            await api(`/api/clientes/${btn.dataset.id}`, { method: 'DELETE' });
            await loadClientesAdmin();
            await loadFechamentos();
        });
    });
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
        if (e.target.matches('.chamado-check'))              onChamadoCheck(e);
        else if (e.target.matches('.feito-check:not(.campo-valor)')) onFeitoCheck(e);
        else if (e.target.matches('.campo-valor'))           onCampoValorChange(e);
    });
}

function bindFilters() {
    $('mesAno').addEventListener('change', (e) => {
        const [ano, mes] = e.target.value.split('-').map(Number);
        state.ano = ano; state.mes = mes;
        salvarFiltros();
        loadFechamentos();
    });

    let debounce;
    $('busca').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            state.busca = e.target.value.trim();
            salvarFiltros();
            loadFechamentos();
        }, 300);
    });

    let debounceContab;
    $('filtroContabilidade').addEventListener('input', (e) => {
        clearTimeout(debounceContab);
        debounceContab = setTimeout(() => {
            state.contabilidade_nome = e.target.value.trim();
            salvarFiltros();
            loadFechamentos();
        }, 300);
    });

    $('filtroFeito').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        $('filtroFeito').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.feito = btn.dataset.val;
        salvarFiltros();
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
        await loadClientesAdmin();
        await loadFechamentos();
    });
}

async function init() {
    initMes();
    bindTableEvents();
    bindFilters();
    bindAdmin();
    conectarWsFechamento();
    await loadContabilidades();
    await loadCampos();
    await Promise.all([loadFechamentos(), loadClientesAdmin()]);
}

init();
