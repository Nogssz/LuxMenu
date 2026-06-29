const $ = (id) => document.getElementById(id);

function limparCnpj(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function formatarCnpj(digitos) {
    if (digitos.length !== 14) return digitos;
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatarData(iso) {
    if (!iso) return '—';
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarTelefone(ddd, numero) {
    if (!ddd || !numero) return '—';
    return `(${ddd}) ${numero}`;
}

function esconderTudo() {
    $('msgErro').classList.remove('show');
    $('msgCliente').classList.remove('show');
    $('resultado').classList.remove('show');
}

function mostrarErro(texto) {
    esconderTudo();
    $('msgErro').textContent = texto;
    $('msgErro').classList.add('show');
}

async function buscarClienteExistente(cnpjFormatado) {
    try {
        const res = await fetch(`/api/clientes?busca=${encodeURIComponent(cnpjFormatado)}`);
        if (!res.ok) return;
        const clientes = await res.json();
        const achou = clientes.find(c => limparCnpj(c.cnpj) === limparCnpj(cnpjFormatado));
        if (achou) {
            $('msgCliente').innerHTML = `Esse CNPJ já está cadastrado como cliente: <b>${achou.nome}</b>. Veja em <a href="fechamento.html">Fechamento de Mês</a>.`;
            $('msgCliente').classList.add('show');
        }
    } catch (e) { /* não bloqueia a consulta principal */ }
}

function renderResultado(dados) {
    const estab = dados.estabelecimento || {};

    $('r-razao').textContent = dados.razao_social || '—';
    $('r-fantasia').textContent = estab.nome_fantasia ? `"${estab.nome_fantasia}"` : '';
    $('r-cnpj').textContent = formatarCnpj(estab.cnpj || '');
    $('r-porte').textContent = dados.porte?.descricao || '—';
    $('r-cnae').textContent = estab.atividade_principal
        ? `${estab.atividade_principal.id} — ${estab.atividade_principal.descricao}` : '—';
    $('r-natureza').textContent = dados.natureza_juridica?.descricao || '—';
    $('r-abertura').textContent = formatarData(estab.data_inicio_atividade);
    $('r-telefone').textContent = formatarTelefone(estab.ddd1, estab.telefone1);
    $('r-endereco').textContent = [
        [estab.tipo_logradouro, estab.logradouro, estab.numero].filter(Boolean).join(' '),
        estab.complemento,
        estab.bairro,
        [estab.cidade?.nome, estab.estado?.sigla].filter(Boolean).join('/'),
        estab.cep,
    ].filter(Boolean).join(' — ') || '—';

    const situacao = (estab.situacao_cadastral || '').toUpperCase();
    const badge = $('r-situacao');
    badge.textContent = situacao || '—';
    badge.className = 'badge ' + (situacao === 'ATIVA' ? 'ativa' : 'outra');

    const ies = estab.inscricoes_estaduais || [];
    $('r-ies').innerHTML = ies.length
        ? ies.map(ie => `<span class="${ie.ativo ? '' : 'inativa'}">${ie.estado?.sigla || '?'} · ${ie.inscricao_estadual}${ie.ativo ? '' : ' (inativa)'}</span>`).join('')
        : '<span class="muted">nenhuma Inscrição Estadual encontrada</span>';

    $('r-cacheinfo').textContent = dados._cache
        ? `consultado em ${new Date(dados._consultado_em).toLocaleString('pt-BR')} (em cache)`
        : `consultado agora em ${new Date(dados._consultado_em).toLocaleString('pt-BR')}`;

    $('resultado').classList.add('show');
    buscarClienteExistente(formatarCnpj(estab.cnpj || ''));
}

async function consultar(forcar) {
    const cnpj = limparCnpj($('cnpj').value);
    if (cnpj.length !== 14) { mostrarErro('Informe um CNPJ com 14 dígitos.'); return; }

    esconderTudo();
    $('btnBuscar').disabled = true;
    $('btnBuscar').textContent = 'Consultando…';

    try {
        const res = await fetch(`/api/cnpj/${cnpj}${forcar ? '?forcar=1' : ''}`);
        const dados = await res.json();
        if (!res.ok) { mostrarErro(dados.error || 'Erro ao consultar CNPJ.'); return; }
        renderResultado(dados);
    } catch (e) {
        mostrarErro('Não foi possível consultar agora. Verifique sua conexão.');
    } finally {
        $('btnBuscar').disabled = false;
        $('btnBuscar').textContent = 'Consultar';
    }
}

$('btnBuscar').addEventListener('click', () => consultar(false));
$('cnpj').addEventListener('keydown', (e) => { if (e.key === 'Enter') consultar(false); });
$('btnAtualizar').addEventListener('click', () => consultar(true));
