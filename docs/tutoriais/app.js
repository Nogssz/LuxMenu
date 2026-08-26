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

// Tira acento e caixa pra "devolucao" achar "Devolução", "carro" achar "Carro" etc.
function normalizarTexto(str) {
    return String(str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Cada nó pode ter até 4 categorias de vídeo, nessa ordem de exibição:
// geral (visão geral — o primeiro que um cliente novo assiste), essenciais
// (funções mais importantes), erros (problemas comuns) e avancado (dicas extras).
const CATEGORIAS_VIDEO = [
    { chave: 'geral', label: 'Visão geral' },
    { chave: 'essenciais', label: 'Funções importantes' },
    { chave: 'erros', label: 'Erros comuns' },
    { chave: 'avancado', label: 'Dicas avançadas' },
];

const VIDEOS_RETAGUARDA = {
    'pessoas>contatos': { geral: [39], essenciais: [40, 41] },
    'pessoas>contador': { essenciais: [42] },
    'pessoas>vendedores': { essenciais: [43] },
    'estoque>produtos': { geral: [44], essenciais: [45], avancado: [46] },
    'estoque>grupo': { essenciais: [47] },
    'estoque>unidades': { essenciais: [48] },
    'estoque>marcas': { essenciais: [49] },
    'estoque>imp-etiqueta': { essenciais: [50] },
    'estoque>ajuste-estoque': { essenciais: [51] },
    'estoque>ajuste-estoque-lote': { essenciais: [52] },
    'estoque>inventario-mensal': { essenciais: [53] },
    'compras>lista-compras': { geral: [54], essenciais: [55, 56] },
    'compras>consulta-notas-fornecedor': {
        geral: [57],
        essenciais: [58, 59],
        nota: 'Se a importação automática não funcionar, não é erro do sistema — às vezes é o site da Receita que está fora do ar. Nesse caso, use a importação pela chave de acesso.',
    },
    'compras>devolucao-compra': { geral: [60], essenciais: [61] },
};

const VIDEOS_PDV = {};

const MENU_RETAGUARDA = [
    { id: 'inicio', label: 'Início', icone: '🏠' },
    { id: 'acesso', label: 'Acesso', icone: '🔑' },
    {
        id: 'pessoas', label: 'Pessoas', icone: '👥',
        submenu: [
            { id: 'contatos', label: 'Contatos' },
            { id: 'vendedores', label: 'Vendedores' },
            { id: 'contador', label: 'Contador' },
        ],
    },
    {
        id: 'estoque', label: 'Estoque', icone: '📦',
        submenu: [
            { id: 'produtos', label: 'Produtos' },
            { id: 'grupo', label: 'Grupo' },
            { id: 'unidades', label: 'Unidades' },
            { id: 'marcas', label: 'Marcas' },
            { id: 'imp-etiqueta', label: 'Imp. de Etiqueta' },
            { id: 'ajuste-estoque', label: 'Ajuste de Estoque' },
            { id: 'ajuste-estoque-lote', label: 'Ajuste de Estoque em Lote' },
            { id: 'inventario-mensal', label: 'Inventário Mensal' },
        ],
    },
    {
        id: 'compras', label: 'Compras', icone: '🛒',
        submenu: [
            { id: 'lista-compras', label: 'Lista Compras' },
            { id: 'consulta-notas-fornecedor', label: 'Consulta Notas de Fornecedor' },
            { id: 'devolucao-compra', label: 'Devolução de Compra' },
        ],
    },
    {
        id: 'vendas', label: 'Vendas', icone: '💲',
        submenu: [
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'pdv-vendas', label: 'PDV - Vendas' },
            { id: 'lista-vendas', label: 'Lista de Vendas' },
            { id: 'devolucao-venda', label: 'Devolução de Venda' },
            { id: 'contratos', label: 'Contratos' },
        ],
    },
    {
        id: 'financeiro', label: 'Financeiro', icone: '💰',
        submenu: [
            { id: 'formas-pagamento', label: 'Formas de Pagamento' },
            { id: 'planos-conta', label: 'Planos de Conta' },
            { id: 'centro-custo', label: 'Centro de Custo' },
            { id: 'contas', label: 'Contas' },
            { id: 'contas-pagar', label: 'Contas à Pagar' },
            { id: 'contas-receber', label: 'Contas à Receber' },
            { id: 'encontro-contas', label: 'Encontro Contas' },
            { id: 'ficha-clientes', label: 'Ficha de Clientes' },
            { id: 'caixas-bancos', label: 'Caixas e Bancos' },
            { id: 'transferencia-conta', label: 'Transferência de Conta' },
            { id: 'impressao-recibo', label: 'Impressão de Recibo' },
        ],
    },
    {
        id: 'fiscal', label: 'Fiscal', icone: '🧾',
        submenu: [
            { id: 'nfse', label: 'NFS-e' },
            { id: 'nfce', label: 'NFC-e' },
            { id: 'nfe', label: 'NF-e' },
            { id: 'cfop', label: 'Cadastro de CFOP' },
        ],
    },
    {
        id: 'servicos', label: 'Serviços', icone: '🔧',
        submenu: [
            { id: 'ordem-servico', label: 'Ordem de Serviço' },
            { id: 'revisao-garantia', label: 'Revisão e Garantia' },
            { id: 'checklist', label: 'Checklist' },
            { id: 'diagnostico-ia', label: 'Diagnóstico IA' },
        ],
    },
    {
        id: 'frotas', label: 'Frotas', icone: '🚚',
        submenu: [
            { id: 'cadastro-veiculos', label: 'Cadastro de Veículos' },
        ],
    },
    {
        id: 'relatorios', label: 'Relatórios', icone: '📊',
        submenu: [
            { id: 'rel-os', label: 'Ordens de Serviço' },
            { id: 'rel-produtos', label: 'Produtos' },
            { id: 'rel-vendas', label: 'Vendas' },
            { id: 'rel-financeiro', label: 'Financeiro' },
            { id: 'rel-resultados', label: 'Resultados' },
        ],
    },
    { id: 'configuracoes', label: 'Configurações', icone: '⚙️' },
];

const MENU_PDV = [
    {
        id: 'caixa', label: 'Caixa', icone: '💵',
        submenu: [
            { id: 'fechar-caixa', label: 'Fechar Caixa' },
            { id: 'resumo-caixa', label: 'Resumo Caixa' },
            { id: 'sangria', label: 'Sangria' },
            { id: 'suprimento', label: 'Suprimento' },
            { id: 'abrir-gaveta', label: 'Abrir Gaveta' },
            { id: 'reimprimir-nfce', label: 'Reimprimir NFCe' },
            { id: 'admin-tef', label: 'Administ. TEF' },
        ],
    },
    {
        id: 'produtos', label: 'Produtos', icone: '📦',
        submenu: [
            { id: 'deleta-item', label: 'Deleta Item' },
            { id: 'deleta-leitor', label: 'Deleta P/ Leitor' },
            { id: 'desconto-item', label: 'Desconto Item' },
            { id: 'busca-preco', label: 'Busca Preço' },
        ],
    },
    {
        id: 'clientes', label: 'Clientes', icone: '👥',
        submenu: [
            { id: 'cad-clientes', label: 'Cad. Clientes' },
            { id: 'receber-conta', label: 'Receber Conta' },
        ],
    },
    { id: 'vendedor', label: 'Vendedor - F3', icone: '🧑' },
    { id: 'busca-avancada', label: 'Busca Avançada - F4', icone: '🔍' },
    { id: 'importar', label: 'Importar - F5', icone: '⬇️' },
    { id: 'cancelar-venda', label: 'Cancelar Venda - F6', icone: '🛒' },
    { id: 'concluir-venda', label: 'Concluir Venda - F7', icone: '🧾' },
    { id: 'adicionar-item', label: 'Adicionar Item - F12', icone: '➕' },
];

const SISTEMAS = {
    retaguarda: { menu: MENU_RETAGUARDA, videos: VIDEOS_RETAGUARDA },
    pdv: { menu: MENU_PDV, videos: VIDEOS_PDV },
};

let sistemaAtivo = 'retaguarda';
const noPorSistema = { retaguarda: 'pessoas>contatos', pdv: 'caixa>resumo-caixa' };
let todosVideos = null;
let fuseIndex = null;

function menuAtual() { return SISTEMAS[sistemaAtivo].menu; }
function noAtivo() { return noPorSistema[sistemaAtivo]; }

// Guarda sistema+tela atual na URL (#retaguarda:pessoas>contatos), assim um F5 ou
// um link direto volta pra mesma tela em vez de sempre reiniciar do zero.
function salvarEstadoNaUrl() {
    history.replaceState(null, '', `#${sistemaAtivo}:${noAtivo()}`);
}

function restaurarEstadoDaUrl() {
    const [sistema, no] = location.hash.slice(1).split(':');
    if (sistema && SISTEMAS[sistema]) sistemaAtivo = sistema;
    if (no) noPorSistema[sistemaAtivo] = no;
}

function limparBuscaGeralUI() {
    $('buscaGeral').value = '';
    $('limparBuscaGeral').hidden = true;
}

function navegarPara(no) {
    noPorSistema[sistemaAtivo] = no;
    limparBuscaGeralUI();
    renderSidebar();
    renderConteudo();
    salvarEstadoNaUrl();
}

function trocarSistema(sistema) {
    sistemaAtivo = sistema;
    limparBuscaGeralUI();
    renderTudo();
    salvarEstadoNaUrl();
}

function videosPara(no) {
    return SISTEMAS[sistemaAtivo].videos[no];
}

function renderTopo() {
    if (sistemaAtivo === 'retaguarda') {
        $('topbar').innerHTML = `
            <div class="topbar">
                <div class="marca"><img src="assets/logos/luxauto-logo.png" alt="LuxAUTO"></div>
                <div class="acoes">
                    <span class="ac clicavel" id="btnEntrarPdv"><span class="ic">🖨️</span><span class="txt">PDV</span></span>
                    <span class="ac clicavel" id="btnApp"><span class="ic">📱</span><span class="txt">APP</span></span>
                    <span class="ac clicavel" id="btnOrdemServico"><span class="ic">📋</span><span class="txt">Ordem de Serviço</span></span>
                    <span class="ac clicavel" id="btnFaturas"><span class="ic">🧾</span><span class="txt">Faturas</span></span>
                    <span class="ac redondo"><img src="assets/logos/whatsapp.png" alt="WhatsApp"></span>
                    <span class="ac redondo">?</span>
                    <span class="ac"><span class="ic">👤</span><span class="txt">ADMIN</span></span>
                </div>
            </div>`;
        $('tabstrip').innerHTML = `
            <div class="tabstrip">
                <div class="tabs">
                    <div class="tab" id="tabDashboard">Dashboard <span class="x">✕</span></div>
                    <div class="tab ativa" id="tabModulo">Tutoriais <span class="x">✕</span></div>
                </div>
            </div>`;
        $('btnEntrarPdv').addEventListener('click', () => trocarSistema('pdv'));
        $('tabDashboard').addEventListener('click', () => navegarPara('inicio'));
        $('btnOrdemServico').addEventListener('click', () => navegarPara('servicos>ordem-servico'));
        $('btnFaturas').addEventListener('click', () => navegarPara('faturas'));
        $('btnApp').addEventListener('click', () => navegarPara('app'));
    } else {
        $('topbar').innerHTML = `
            <div class="topbar pdv">
                <div class="marca-pdv"><img src="assets/logos/pdv-logo.png" alt="PDV">CAIXA ABERTO</div>
                <div class="acoes-pdv">
                    <span class="ac clicavel" id="btnVoltarRetaguarda"><img class="ic-img" src="assets/logos/retaguarda-icon.png" alt=""><span class="txt">Retaguarda</span></span>
                    <span class="lux-txt">LUX SISTEMAS</span>
                    <span class="ajuda">❓ Ajuda</span>
                    <span class="janela-ic">▢</span>
                    <span class="janela-ic">✕</span>
                </div>
            </div>`;
        $('tabstrip').innerHTML = `
            <div class="tabstrip">
                <div class="tabs">
                    <div class="tab ativa" id="tabModulo">Tutoriais</div>
                </div>
            </div>`;
        $('btnVoltarRetaguarda').addEventListener('click', () => trocarSistema('retaguarda'));
    }
    document.body.classList.toggle('modo-pdv', sistemaAtivo === 'pdv');
}

function renderSidebar() {
    const menu = menuAtual();
    const no = noAtivo();
    $('sidebar').innerHTML = menu.map((mod) => {
        if (!mod.submenu) {
            return `<div class="item-menu ${no === mod.id ? 'ativo' : ''}" data-no="${mod.id}"><span class="ic">${mod.icone}</span><span class="lbl">${escapeHtml(mod.label)}</span></div>`;
        }
        const submenuAberto = no.startsWith(mod.id + '>');
        const subitens = mod.submenu.map((sub) => {
            const subno = `${mod.id}>${sub.id}`;
            return `<div class="subitem ${subno === no ? 'ativo' : ''}" data-no="${subno}">${escapeHtml(sub.label)}</div>`;
        }).join('');
        return `
            <div class="item-menu ${submenuAberto ? 'aberto' : ''}" data-modulo="${mod.id}">
                <span class="ic">${mod.icone}</span><span class="lbl">${escapeHtml(mod.label)}</span><span class="seta">▶</span>
            </div>
            <div class="submenu ${submenuAberto ? 'aberto' : ''}" data-submenu-de="${mod.id}">${subitens}</div>`;
    }).join('');
}

const EXTRAS_LABEL = { faturas: 'Faturas', app: 'App' };

function labelDoNo(no) {
    const [moduloId, subId] = no.split('>');
    const modulo = menuAtual().find((m) => m.id === moduloId);
    if (!modulo) return [EXTRAS_LABEL[no] || no];
    if (!subId) return [modulo.label];
    const sub = modulo.submenu.find((s) => s.id === subId);
    return [modulo.label, sub ? sub.label : subId];
}

function cardVideoHtml(v) {
    const thumb = thumbUrl(v.url);
    return `
        <div class="vcard">
            ${thumb ? `<img class="vthumb" src="${thumb}" alt="">` : '<div class="vthumb"></div>'}
            <div class="vbody">
                <h2>${escapeHtml(v.titulo)}</h2>
                ${v.descricao ? `<p class="vdesc">${escapeHtml(v.descricao)}</p>` : ''}
                <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">▶ assistir</a>
            </div>
        </div>`;
}

function placeholderHtml(texto) {
    return `<div class="placeholder"><div class="ic">🚧</div><p>${escapeHtml(texto)}</p></div>`;
}

async function carregarVideos() {
    if (todosVideos) return todosVideos;
    try {
        const res = await fetch('videos.json');
        if (!res.ok) { todosVideos = 'erro'; return todosVideos; }
        todosVideos = await res.json();
    } catch {
        todosVideos = 'erro';
        return todosVideos;
    }
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
        getFn: (obj, path) => normalizarTexto(obj[Array.isArray(path) ? path[0] : path]),
    });
    return todosVideos;
}

async function renderBuscaGeral(query) {
    const videos = await carregarVideos();
    if (videos === 'erro' || !fuseIndex) return;
    const resultados = fuseIndex.search(normalizarTexto(query)).map((r) => r.item);
    $('conteudo').innerHTML = `
        <div class="trilha">Busca geral</div>
        <h1>Resultados para "${escapeHtml(query)}"</h1>
        <p class="resultado-info">${resultados.length} vídeo${resultados.length !== 1 ? 's' : ''} encontrado${resultados.length !== 1 ? 's' : ''}</p>
        ${resultados.length ? `<div class="grid-videos">${resultados.map(cardVideoHtml).join('')}</div>` : placeholderHtml('Nenhum vídeo encontrado para essa busca.')}
    `;
}

async function renderConteudo() {
    const no = noAtivo();
    const [tituloModulo, tituloSub] = labelDoNo(no);
    $('tabModulo').innerHTML = `${escapeHtml(tituloSub || tituloModulo)} <span class="x">✕</span>`;
    $('conteudo').innerHTML = `<div class="trilha">${escapeHtml(tituloModulo)}${tituloSub ? ' / ' + escapeHtml(tituloSub) : ''}</div><h1>Tutoriais em vídeo</h1><div id="areaVideos">carregando…</div>`;

    const categorias = videosPara(no);
    if (!categorias) {
        $('areaVideos').outerHTML = `<div id="areaVideos">${placeholderHtml('Os tutoriais desse módulo ainda estão sendo organizados — em breve chegam aqui.')}</div>`;
        return;
    }

    const videos = await carregarVideos();
    if (videos === 'erro') {
        $('areaVideos').outerHTML = `<div id="areaVideos">${placeholderHtml('Não consegui carregar os vídeos agora.')}</div>`;
        return;
    }

    const porId = Object.fromEntries(videos.map((v) => [v.id, v]));
    const secoesHtml = CATEGORIAS_VIDEO.map(({ chave, label }) => {
        const ids = categorias[chave];
        if (!ids || !ids.length) return '';
        const encontrados = ids.map((id) => porId[id]).filter(Boolean);
        if (!encontrados.length) return '';
        return `<div class="secao-videos">
            <h2 class="secao-titulo">${escapeHtml(label)}</h2>
            <div class="grid-videos">${encontrados.map(cardVideoHtml).join('')}</div>
        </div>`;
    }).join('');

    const notaHtml = categorias.nota ? `<div class="aviso-nota">⚠️ ${escapeHtml(categorias.nota)}</div>` : '';
    const filtroHtml = secoesHtml ? `<input type="text" class="busca-submenu" id="buscaSubmenu" placeholder="Filtrar vídeos dessa tela...">` : '';
    $('areaVideos').outerHTML = `<div id="areaVideos">${notaHtml}${filtroHtml}${secoesHtml || placeholderHtml('Os tutoriais desse módulo ainda estão sendo organizados — em breve chegam aqui.')}</div>`;

    const buscaSub = $('buscaSubmenu');
    if (buscaSub) {
        buscaSub.addEventListener('input', () => {
            const termo = normalizarTexto(buscaSub.value.trim());
            document.querySelectorAll('#areaVideos .secao-videos').forEach((secao) => {
                let algumVisivel = false;
                secao.querySelectorAll('.vcard').forEach((card) => {
                    const titulo = normalizarTexto(card.querySelector('h2').textContent);
                    const visivel = !termo || titulo.includes(termo);
                    card.style.display = visivel ? '' : 'none';
                    if (visivel) algumVisivel = true;
                });
                secao.style.display = algumVisivel ? '' : 'none';
            });
        });
    }
}

function renderTudo() {
    renderTopo();
    renderSidebar();
    renderConteudo();
}

document.body.addEventListener('click', (e) => {
    const sub = e.target.closest('.subitem');
    if (sub) {
        navegarPara(sub.dataset.no);
        return;
    }
    const item = e.target.closest('.item-menu[data-modulo]');
    if (item) {
        const modId = item.dataset.modulo;
        const atual = noAtivo();
        navegarPara(atual.startsWith(modId + '>') ? modId : `${modId}>${menuAtual().find((m) => m.id === modId).submenu[0].id}`);
        return;
    }
    const simples = e.target.closest('.item-menu[data-no]');
    if (simples) {
        navegarPara(simples.dataset.no);
    }
});

let debounceBuscaGeral;
$('buscaGeral').addEventListener('input', () => {
    clearTimeout(debounceBuscaGeral);
    const valor = $('buscaGeral').value.trim();
    $('limparBuscaGeral').hidden = !valor;
    debounceBuscaGeral = setTimeout(() => {
        if (valor.length >= 2) renderBuscaGeral(valor);
        else renderConteudo();
    }, 150);
});

$('limparBuscaGeral').addEventListener('click', () => {
    $('buscaGeral').value = '';
    $('limparBuscaGeral').hidden = true;
    renderConteudo();
});

restaurarEstadoDaUrl();
renderTudo();
salvarEstadoNaUrl();
