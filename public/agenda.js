const $ = (id) => document.getElementById(id);

const HORA_INICIO = 7;
const HORA_FIM = 21;
const ALTURA_HORA = 44;
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

$('agendaTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.agenda-tab');
    if (!btn) return;
    $('agendaTabs').querySelectorAll('.agenda-tab').forEach((b) => b.classList.toggle('active', b === btn));
    $('painelTarefas').style.display = btn.dataset.painel === 'painelTarefas' ? '' : 'none';
    $('painelCalendario').style.display = btn.dataset.painel === 'painelCalendario' ? '' : 'none';
});

// Barra de rolagem "fantasma" fixa perto do rodapé da tela, sincronizada com o quadro de
// tarefas — assim dá pra navegar entre as colunas sem precisar rolar até o fim de uma
// coluna comprida pra achar a barra de rolagem real.
(function configurarScrollSync() {
    const sync = $('boardScrollSync');
    const board = $('tarefasBoard');
    const trilha = $('boardScrollSyncTrack');

    function atualizarLargura() {
        trilha.style.width = `${board.scrollWidth}px`;
    }

    sync.addEventListener('scroll', () => { board.scrollLeft = sync.scrollLeft; });
    board.addEventListener('scroll', () => { sync.scrollLeft = board.scrollLeft; });

    new ResizeObserver(atualizarLargura).observe(board);
    atualizarLargura();
})();

function paraISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hojeISO() {
    return paraISO(new Date());
}

function formatarDataBR(iso) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}`;
}

function domingoDaSemana(iso) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() - d.getDay());
    return paraISO(d);
}

function diasDaSemana(domingoISO) {
    const base = new Date(`${domingoISO}T00:00:00`);
    const dias = [];
    for (let i = 0; i < 7; i++) dias.push(paraISO(new Date(base.getTime() + i * 86400000)));
    return dias;
}

function formatarFaixaSemana(domingoISO) {
    const inicio = new Date(`${domingoISO}T00:00:00`);
    const fim = new Date(inicio.getTime() + 6 * 86400000);
    const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear();
    if (mesmoMes) return `${inicio.getDate()} a ${fim.getDate()} de ${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
    return `${inicio.getDate()} ${MESES[inicio.getMonth()]} a ${fim.getDate()} ${MESES[fim.getMonth()]} de ${fim.getFullYear()}`;
}

function minutosDesde(horaStr) {
    const [h, m] = horaStr.split(':').map(Number);
    return (h - HORA_INICIO) * 60 + m;
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

const state = {
    semanaInicio: domingoDaSemana(hojeISO()),
};
let compromissos = [];
let compromissosFuturos = [];
let tarefas = [];
let pessoas = [];
let modalAberto = false;

function corPessoa(pessoa_id) {
    const p = pessoas.find((x) => x.id === pessoa_id);
    if (!p) return 'var(--ink-faint)';
    const n = ((p.ordem - 1) % 5) + 1;
    return `var(--pessoa-${n})`;
}

// Algoritmo simples de "interval graph coloring": dá a cada compromisso a primeira
// coluna livre entre os que ele sobrepõe no mesmo dia, e calcula quantas colunas
// o grupo sobreposto usou, pra dividir a largura do dia entre eles.
function layoutDia(itensOriginais) {
    const itens = itensOriginais.slice().sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    const ativos = [];
    itens.forEach((it) => {
        for (let i = ativos.length - 1; i >= 0; i--) {
            if (ativos[i].fim <= it.hora_inicio) ativos.splice(i, 1);
        }
        const usadas = new Set(ativos.map((a) => a.coluna));
        let col = 0;
        while (usadas.has(col)) col++;
        it._coluna = col;
        ativos.push({ fim: it.hora_fim, coluna: col });
    });
    itens.forEach((it) => {
        const sobrepostos = itens.filter((o) => o.hora_inicio < it.hora_fim && o.hora_fim > it.hora_inicio);
        it._totalColunas = Math.max(...sobrepostos.map((o) => o._coluna)) + 1;
    });
    return itens;
}

function blocoCompromissoHtml(c) {
    const top = minutosDesde(c.hora_inicio) * (ALTURA_HORA / 60);
    const altura = Math.max(20, (minutosDesde(c.hora_fim) - minutosDesde(c.hora_inicio)) * (ALTURA_HORA / 60));
    const largura = 100 / c._totalColunas;
    const esquerda = c._coluna * largura;
    return `<div class="compromisso" data-id="${c.id}" style="top:${top}px;height:${altura}px;left:${esquerda}%;width:calc(${largura}% - 3px);background:${corPessoa(c.pessoa_id)}">
        <span class="hora">${c.hora_inicio}–${c.hora_fim}</span>${escapeHtml(c.titulo)}
    </div>`;
}

function renderGrid() {
    const dias = diasDaSemana(state.semanaInicio);
    const hoje = hojeISO();
    $('tituloSemana').textContent = formatarFaixaSemana(state.semanaInicio);

    let html = '<div class="cal-corner"></div>';
    dias.forEach((iso) => {
        const d = new Date(`${iso}T00:00:00`);
        const ehHoje = iso === hoje;
        html += `<div class="cal-day-head ${ehHoje ? 'hoje' : ''}">${DIAS_SEMANA[d.getDay()]}<div class="dnum">${d.getDate()}</div></div>`;
    });

    html += '<div class="cal-hours">';
    for (let h = HORA_INICIO; h < HORA_FIM; h++) {
        html += `<div class="cal-hour-label">${String(h).padStart(2, '0')}:00</div>`;
    }
    html += '</div>';

    dias.forEach((iso) => {
        const ehHoje = iso === hoje;
        html += `<div class="cal-day-col ${ehHoje ? 'hoje' : ''}" data-dia="${iso}" style="height:${(HORA_FIM - HORA_INICIO) * ALTURA_HORA}px"></div>`;
    });

    $('calGrid').innerHTML = html;

    dias.forEach((iso) => {
        const col = $('calGrid').querySelector(`.cal-day-col[data-dia="${iso}"]`);
        const doDia = compromissos.filter((c) => c.data === iso);
        layoutDia(doDia).forEach((c) => col.insertAdjacentHTML('beforeend', blocoCompromissoHtml(c)));
    });

    $('calGrid').querySelectorAll('.cal-day-col').forEach((col) => {
        col.addEventListener('click', (e) => {
            if (e.target.closest('.compromisso')) return;
            const rect = col.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hora = HORA_INICIO + Math.floor(y / ALTURA_HORA);
            abrirModalNovo(col.dataset.dia, hora);
        });
    });

    $('calGrid').querySelectorAll('.compromisso').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const c = compromissos.find((x) => x.id === Number(el.dataset.id));
            if (c) abrirModalEditar(c);
        });
    });
}

// Quadro estilo "uma coluna por pessoa": Geral (sem responsável) + cada pessoa ativa.
// Cada coluna mostra suas tarefas pendentes + os próprios compromissos futuros
// (algo que o Google Agenda não faz — junta os dois tipos na mesma lista da pessoa).
function renderQuadro() {
    const hoje = hojeISO();
    const pessoasOrdenadas = pessoas.filter((p) => p.ativo).sort((a, b) => a.ordem_agenda - b.ordem_agenda);
    const colunas = [{ id: null, nome: 'Geral' }, ...pessoasOrdenadas.map((p) => ({ id: p.id, nome: p.nome }))];

    $('tarefasBoard').innerHTML = colunas.map((col) => {
        const tarefasCol = tarefas.filter((t) => (t.pessoa_id || null) === col.id);
        const pendentes = tarefasCol.filter((t) => !t.feito);
        const concluidas = tarefasCol.filter((t) => t.feito);
        const compsCol = compromissosFuturos.filter((c) => (c.pessoa_id || null) === col.id);

        const itens = [
            ...pendentes.map((t) => ({ tipo: 'tarefa', data: t.data, hora: t.hora || '', obj: t })),
            ...compsCol.map((c) => ({ tipo: 'compromisso', data: c.data, hora: c.hora_inicio, obj: c })),
        ].sort((a, b) => {
            if (!a.data && !b.data) return 0;
            if (!a.data) return 1;
            if (!b.data) return -1;
            if (a.data !== b.data) return a.data < b.data ? -1 : 1;
            return a.hora.localeCompare(b.hora);
        });

        return `<div class="coluna-pessoa">
            <div class="coluna-head"><span class="dot" style="background:${col.id ? corPessoa(col.id) : 'var(--ink-faint)'}"></span>${escapeHtml(col.nome)}</div>
            <button type="button" class="btn-add-tarefa" data-pessoa="${col.id || ''}">+ Adicionar tarefa</button>
            <form class="add-tarefa-rapida" data-pessoa="${col.id || ''}" hidden>
                <input type="text" class="add-tarefa-input" placeholder="título da tarefa">
                <input type="text" class="add-tarefa-desc" placeholder="detalhes (opcional)">
                <div class="linha-data-hora">
                    <input type="date" class="add-tarefa-data" title="data (opcional)">
                    <input type="time" class="add-tarefa-hora" title="horário (opcional)">
                </div>
                <div class="add-tarefa-acoes">
                    <button type="submit" class="btn">Adicionar</button>
                    <button type="button" class="btn secundario btn-cancelar-tarefa">Cancelar</button>
                </div>
            </form>
            <div class="coluna-lista">
                ${itens.map((it) => it.tipo === 'tarefa' ? linhaTarefaHtml(it.obj) : linhaCompromissoHtml(it.obj)).join('') || '<p class="vazio-grupo">tudo certo por aqui</p>'}
            </div>
            ${concluidas.length ? `<details class="coluna-concluidas"><summary>Concluídas (${concluidas.length})</summary><div class="coluna-concluidas-lista">${concluidas.map(linhaTarefaHtml).join('')}</div></details>` : ''}
        </div>`;
    }).join('');

    $('tarefasBoard').querySelectorAll('.tarefa-check').forEach((chk) => {
        chk.addEventListener('change', async () => {
            await api(`/api/agenda/tarefas/${chk.dataset.id}`, { method: 'PUT', body: JSON.stringify({ feito: chk.checked }) });
            await carregarTarefas();
        });
    });

    $('tarefasBoard').querySelectorAll('.tarefa-menu-trocar').forEach((btn) => {
        btn.addEventListener('click', () => {
            const painel = btn.closest('.tarefa-menu-painel');
            painel.querySelector('.tarefa-menu-raiz').hidden = true;
            painel.querySelector('.tarefa-menu-pessoas').hidden = false;
        });
    });

    $('tarefasBoard').querySelectorAll('.tarefa-menu-voltar').forEach((btn) => {
        btn.addEventListener('click', () => {
            const painel = btn.closest('.tarefa-menu-painel');
            painel.querySelector('.tarefa-menu-pessoas').hidden = true;
            painel.querySelector('.tarefa-menu-raiz').hidden = false;
        });
    });

    $('tarefasBoard').querySelectorAll('.tarefa-menu-editar').forEach((btn) => {
        btn.addEventListener('click', () => {
            const t = tarefas.find((x) => x.id === Number(btn.dataset.id));
            btn.closest('details').open = false;
            if (t) abrirModalTarefa(t);
        });
    });

    $('tarefasBoard').querySelectorAll('.tarefa-mover-opcao').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const details = btn.closest('details.tarefa-menu');
            await api(`/api/agenda/tarefas/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ pessoa_id: btn.dataset.pessoa || null }) });
            if (details) details.open = false;
            await carregarTarefas();
        });
    });

    $('tarefasBoard').querySelectorAll('.tarefa-menu-excluir').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!confirm('Excluir esta tarefa?')) return;
            await api(`/api/agenda/tarefas/${btn.dataset.id}`, { method: 'DELETE' });
            await carregarTarefas();
        });
    });

    $('tarefasBoard').querySelectorAll('.btn-add-tarefa').forEach((btn) => {
        btn.addEventListener('click', () => {
            btn.hidden = true;
            const form = btn.nextElementSibling;
            form.hidden = false;
            form.querySelector('.add-tarefa-input').focus();
        });
    });

    $('tarefasBoard').querySelectorAll('.btn-cancelar-tarefa').forEach((btn) => {
        btn.addEventListener('click', () => {
            const form = btn.closest('.add-tarefa-rapida');
            form.reset();
            form.hidden = true;
            form.previousElementSibling.hidden = false;
        });
    });

    // Recolhe o formulário sozinho se o usuário clicar fora dele sem enviar nem cancelar.
    $('tarefasBoard').querySelectorAll('.add-tarefa-rapida').forEach((form) => {
        form.addEventListener('focusout', (e) => {
            if (form.contains(e.relatedTarget)) return;
            setTimeout(() => {
                if (form.hidden || form.contains(document.activeElement)) return;
                form.reset();
                form.hidden = true;
                form.previousElementSibling.hidden = false;
            }, 150);
        });
    });

    $('tarefasBoard').querySelectorAll('.item-compromisso').forEach((el) => {
        el.addEventListener('click', () => {
            const c = compromissosFuturos.find((x) => x.id === Number(el.dataset.id));
            if (c) abrirModalEditar(c);
        });
    });

    $('tarefasBoard').querySelectorAll('.add-tarefa-rapida').forEach((form) => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = form.querySelector('.add-tarefa-input');
            const descInput = form.querySelector('.add-tarefa-desc');
            const dataInput = form.querySelector('.add-tarefa-data');
            const horaInput = form.querySelector('.add-tarefa-hora');
            const titulo = input.value.trim();
            if (!titulo) return;
            try {
                await api('/api/agenda/tarefas', {
                    method: 'POST',
                    body: JSON.stringify({
                        titulo,
                        descricao: descInput.value.trim() || null,
                        pessoa_id: form.dataset.pessoa || null,
                        data: dataInput.value || null,
                        hora: horaInput.value || null,
                    }),
                });
                input.value = '';
                descInput.value = '';
                dataInput.value = '';
                horaInput.value = '';
                await carregarTarefas();
            } catch (err) { alert(err.message); }
        });
    });
}

function linhaTarefaHtml(t) {
    const opcoesPessoas = [
        `<button type="button" class="tarefa-mover-opcao" data-id="${t.id}" data-pessoa="">Geral</button>`,
        ...pessoas.filter((p) => p.ativo || p.id === t.pessoa_id)
            .map((p) => `<button type="button" class="tarefa-mover-opcao" data-id="${t.id}" data-pessoa="${p.id}">${escapeHtml(p.nome)}</button>`),
    ].join('');
    return `<div class="tarefa-linha ${t.feito ? 'feita' : ''}">
        <div class="tarefa-principal">
            <input type="checkbox" class="tarefa-check" data-id="${t.id}" ${t.feito ? 'checked' : ''}>
            <div class="tarefa-textos">
                <span class="tit">${escapeHtml(t.titulo)}</span>
                ${t.descricao ? `<span class="tarefa-desc">${escapeHtml(t.descricao)}</span>` : ''}
            </div>
            <details class="tarefa-menu">
                <summary title="mais opções">⋮</summary>
                <div class="tarefa-menu-painel">
                    <div class="tarefa-menu-raiz">
                        <button type="button" class="tarefa-menu-editar" data-id="${t.id}">Editar</button>
                        <button type="button" class="tarefa-menu-trocar">Trocar</button>
                        <button type="button" class="tarefa-menu-excluir" data-id="${t.id}">Excluir</button>
                    </div>
                    <div class="tarefa-menu-pessoas" hidden>
                        <button type="button" class="tarefa-menu-voltar">← Voltar</button>
                        ${opcoesPessoas}
                    </div>
                </div>
            </details>
        </div>
        ${t.data ? `<div class="tarefa-meta"><span class="tarefa-data">${formatarDataBR(t.data)}${t.hora ? ' ' + t.hora : ''}</span></div>` : ''}
    </div>`;
}

function linhaCompromissoHtml(c) {
    return `<div class="item-compromisso" data-id="${c.id}" title="Compromisso — clique para editar">
        <span class="hora">${formatarDataBR(c.data)} · ${c.hora_inicio}</span>
        <span class="tit">${escapeHtml(c.titulo)}</span>
    </div>`;
}

async function carregarCompromissos() {
    const dias = diasDaSemana(state.semanaInicio);
    compromissos = await api(`/api/agenda/compromissos?inicio=${dias[0]}&fim=${dias[6]}`);
    renderGrid();
}

async function carregarTarefas() {
    [tarefas, compromissosFuturos] = await Promise.all([
        api('/api/agenda/tarefas'),
        api(`/api/agenda/compromissos?inicio=${hojeISO()}`),
    ]);
    renderQuadro();
}

async function carregarPessoas() {
    pessoas = await api('/api/escala/pessoas');
    const opcoes = pessoas.filter((p) => p.ativo).map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
    $('compPessoa').innerHTML = '<option value="">Sem responsável</option>' + opcoes;
    $('tarefaEditPessoa').innerHTML = '<option value="">Geral</option>' + opcoes;
}

function abrirModalNovo(dia, hora) {
    modalAberto = true;
    $('modalTitulo').textContent = 'Novo compromisso';
    $('compId').value = '';
    $('compTitulo').value = '';
    $('compDescricao').value = '';
    $('compData').value = dia;
    $('compHoraInicio').value = `${String(hora).padStart(2, '0')}:00`;
    $('compHoraFim').value = `${String(Math.min(hora + 1, 23)).padStart(2, '0')}:00`;
    $('compPessoa').value = '';
    $('btnExcluirComp').style.display = 'none';
    $('overlayCompromisso').style.display = 'flex';
    $('compTitulo').focus();
}

function abrirModalEditar(c) {
    modalAberto = true;
    $('modalTitulo').textContent = 'Editar compromisso';
    $('compId').value = c.id;
    $('compTitulo').value = c.titulo;
    $('compDescricao').value = c.descricao || '';
    $('compData').value = c.data;
    $('compHoraInicio').value = c.hora_inicio;
    $('compHoraFim').value = c.hora_fim;
    $('compPessoa').value = c.pessoa_id || '';
    $('btnExcluirComp').style.display = '';
    $('overlayCompromisso').style.display = 'flex';
}

function fecharModalComp() {
    modalAberto = false;
    $('overlayCompromisso').style.display = 'none';
}

$('btnCancelarComp').addEventListener('click', fecharModalComp);
$('overlayCompromisso').addEventListener('click', (e) => {
    if (e.target.id === 'overlayCompromisso') fecharModalComp();
});

$('formCompromisso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('compId').value;
    const payload = {
        titulo: $('compTitulo').value.trim(),
        descricao: $('compDescricao').value.trim() || null,
        data: $('compData').value,
        hora_inicio: $('compHoraInicio').value,
        hora_fim: $('compHoraFim').value,
        pessoa_id: $('compPessoa').value || null,
    };
    try {
        if (id) await api(`/api/agenda/compromissos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        else await api('/api/agenda/compromissos', { method: 'POST', body: JSON.stringify(payload) });
        fecharModalComp();
        await Promise.all([carregarCompromissos(), carregarTarefas()]);
    } catch (err) { alert(err.message); }
});

$('btnExcluirComp').addEventListener('click', async () => {
    const id = $('compId').value;
    if (!id || !confirm('Excluir este compromisso?')) return;
    try {
        await api(`/api/agenda/compromissos/${id}`, { method: 'DELETE' });
        fecharModalComp();
        await Promise.all([carregarCompromissos(), carregarTarefas()]);
    } catch (err) { alert(err.message); }
});

function abrirModalTarefa(t) {
    modalAberto = true;
    $('tarefaEditId').value = t.id;
    $('tarefaEditTitulo').value = t.titulo;
    $('tarefaEditDescricao').value = t.descricao || '';
    $('tarefaEditData').value = t.data || '';
    $('tarefaEditHora').value = t.hora || '';
    $('tarefaEditPessoa').value = t.pessoa_id || '';
    $('overlayTarefa').style.display = 'flex';
    $('tarefaEditTitulo').focus();
}

function fecharModalTarefa() {
    modalAberto = false;
    $('overlayTarefa').style.display = 'none';
}

$('btnCancelarTarefaEdit').addEventListener('click', fecharModalTarefa);
$('overlayTarefa').addEventListener('click', (e) => {
    if (e.target.id === 'overlayTarefa') fecharModalTarefa();
});

$('formTarefaEditar').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('tarefaEditId').value;
    const payload = {
        titulo: $('tarefaEditTitulo').value.trim(),
        descricao: $('tarefaEditDescricao').value.trim() || null,
        data: $('tarefaEditData').value || null,
        hora: $('tarefaEditHora').value || null,
        pessoa_id: $('tarefaEditPessoa').value || null,
    };
    try {
        await api(`/api/agenda/tarefas/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        fecharModalTarefa();
        await carregarTarefas();
    } catch (err) { alert(err.message); }
});

$('btnExcluirTarefaEdit').addEventListener('click', async () => {
    const id = $('tarefaEditId').value;
    if (!id || !confirm('Excluir esta tarefa?')) return;
    try {
        await api(`/api/agenda/tarefas/${id}`, { method: 'DELETE' });
        fecharModalTarefa();
        await carregarTarefas();
    } catch (err) { alert(err.message); }
});

$('btnSemanaAnterior').addEventListener('click', () => {
    state.semanaInicio = paraISO(new Date(new Date(`${state.semanaInicio}T00:00:00`).getTime() - 7 * 86400000));
    carregarCompromissos();
});
$('btnSemanaSeguinte').addEventListener('click', () => {
    state.semanaInicio = paraISO(new Date(new Date(`${state.semanaInicio}T00:00:00`).getTime() + 7 * 86400000));
    carregarCompromissos();
});
$('btnHoje').addEventListener('click', () => {
    state.semanaInicio = domingoDaSemana(hojeISO());
    carregarCompromissos();
});

async function init() {
    await carregarPessoas();
    await Promise.all([carregarCompromissos(), carregarTarefas()]);
}
init();

// Se o foco estiver em algum campo dentro do quadro de tarefas (digitando uma tarefa
// nova, com o seletor de "mover" aberto, etc.), pula o ciclo de polling — senão o
// re-render apaga o que a pessoa estava escrevendo antes de salvar.
function boardEmUso() {
    const el = document.activeElement;
    return !!(el && $('tarefasBoard').contains(el));
}

setInterval(() => {
    if (document.hidden || modalAberto || boardEmUso()) return;
    carregarCompromissos();
    carregarTarefas();
}, 15000);
