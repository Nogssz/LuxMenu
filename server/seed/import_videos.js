const db = require('../db');

const VIDEOS = [
    { titulo: 'Como pagar suas faturas?', url: 'https://www.youtube.com/watch?v=iO9ohIOCq6I&t=2s', categoria: 'Financeiro', tags: 'pagar fatura, fatura, pagamento' },
    { titulo: 'Cadastro de clientes e fornecedores', url: 'https://www.youtube.com/watch?v=D_4zbfkYelw', categoria: 'Cadastros', tags: 'cadastro cliente, cadastro fornecedor, cliente, fornecedor' },
    { titulo: 'Dúvidas comuns no cadastro de clientes', url: 'https://www.youtube.com/watch?v=PQfeMG9Y3p0', categoria: 'Cadastros', tags: 'cadastro cliente, dúvidas, cliente' },
    { titulo: 'Erro de I.E', url: 'https://www.youtube.com/watch?v=RO6DYbwKq3M', categoria: 'Cadastros', tags: 'inscrição estadual, IE, erro cadastro, cliente, fornecedor' },
    { titulo: 'Nota de fornecedores - importação', url: 'https://www.youtube.com/watch?v=zHSFtihqfLo', categoria: 'Fiscal', tags: 'nota fiscal, importação de nota, NFe, fornecedor, compra' },
    { titulo: 'Nota de fornecedor manual', url: 'https://www.youtube.com/watch?v=xSmPD5xVprQ', categoria: 'Fiscal', tags: 'nota fiscal manual, NFe manual, fornecedor, compra' },
    { titulo: 'Nota de fornecedor manual — inserindo os produtos', url: 'https://www.youtube.com/watch?v=xSmPD5xVprQ', categoria: 'Fiscal', tags: 'nota fiscal manual, inserir produtos, NFe, fornecedor' },
    { titulo: 'Devolução de compra', url: 'https://www.youtube.com/watch?v=FF-1rf2Y9zk', categoria: 'Fiscal', tags: 'devolução de compra, nota de devolução, fornecedor' },
    { titulo: 'Criação de ordem de serviço do zero', url: 'https://www.youtube.com/watch?v=KFbubhp3gYE', categoria: 'Ordens de Serviço', tags: 'ordem de serviço, OS, criar OS' },
    { titulo: 'Etapas da O.S', url: 'https://www.youtube.com/watch?v=CFd8g44Q7t4', categoria: 'Ordens de Serviço', tags: 'ordem de serviço, OS, etapas' },
    { titulo: 'Gerar O.S através de orçamento', url: 'https://www.youtube.com/watch?v=Qp912zktTvE', categoria: 'Ordens de Serviço', tags: 'ordem de serviço, OS, orçamento, gerar OS' },
    { titulo: 'Adicionar fotos na O.S', url: 'https://www.youtube.com/watch?v=TqDAuiAGhRo', categoria: 'Ordens de Serviço', tags: 'ordem de serviço, OS, fotos' },
    { titulo: 'Como criar um orçamento', url: 'https://www.youtube.com/watch?v=-J_3LAlFYuk', categoria: 'Orçamentos', tags: 'orçamento, criar orçamento' },
    { titulo: 'Como agendar um orçamento', url: 'https://www.youtube.com/watch?v=8bk5QVslFyA', categoria: 'Orçamentos', tags: 'orçamento, agendar orçamento, agendamento' },
    { titulo: 'Resuminho do PDV', url: 'https://www.youtube.com/watch?v=ychLHt3X6G0', categoria: 'Venda/PDV', tags: 'PDV, ponto de venda, venda, resumo' },
    { titulo: 'Ensinando pedidos', url: 'https://www.youtube.com/watch?v=Spdgph05WuY', categoria: 'Venda/PDV', tags: 'pedido, pedidos, venda' },
    { titulo: 'Plano de contas e centro de custos', url: 'https://www.youtube.com/watch?v=fD-1VZC0X7s', categoria: 'Financeiro', tags: 'plano de contas, centro de custo' },
    { titulo: 'Formas de pagamento', url: 'https://www.youtube.com/watch?v=V_UdVo5jp3s', categoria: 'Financeiro', tags: 'forma de pagamento, pagamento' },
    { titulo: 'Contas a pagar', url: 'https://www.youtube.com/watch?v=Cg9n4NCaad4', categoria: 'Financeiro', tags: 'contas a pagar, fatura' },
    { titulo: 'Caixas e bancos', url: 'https://www.youtube.com/watch?v=JTwQNCCsB-E', categoria: 'Financeiro', tags: 'caixa, banco' },
    { titulo: 'Contas a pagar (parte 2)', url: 'https://www.youtube.com/watch?v=IExf8nR08XQ&t=1s', categoria: 'Financeiro', tags: 'contas a pagar' },
    { titulo: 'Transferência de contas', url: 'https://www.youtube.com/watch?v=vwH0cyylHiQ', categoria: 'Financeiro', tags: 'transferência, conta, banco' },
    { titulo: 'Importar O.S na nota fiscal', url: 'https://www.youtube.com/watch?v=WNA_it03Ti0&t=1s', categoria: 'Fiscal', tags: 'ordem de serviço, OS, nota fiscal, importar OS, NFe' },
    { titulo: 'Emissão de NFSe', url: 'https://www.youtube.com/watch?v=bodfByNxVpU', categoria: 'Fiscal', tags: 'NFSe, nota fiscal de serviço, emissão' },
    { titulo: 'Devolução de NFe', url: 'https://www.youtube.com/watch?v=y1vFr-D-MTU', categoria: 'Fiscal', tags: 'devolução, NFe, nota fiscal' },
    { titulo: 'Envio de documentos fiscais para contabilidade', url: 'https://www.youtube.com/watch?v=QUUXGFMsYgw', categoria: 'Fiscal', tags: 'contabilidade, envio de documentos' },
    { titulo: 'Emitindo NFC-e pelo PDV', url: 'https://www.youtube.com/watch?v=72x5f8YLOh8', categoria: 'Fiscal', tags: 'NFCe, PDV, emissão, cupom fiscal' },
    { titulo: 'Liberação de CFOP, IBS e CBS do produto', url: 'https://www.youtube.com/watch?v=s8YIS-KCJBQ', categoria: 'Fiscal', tags: 'CFOP, IBS, CBS, produto, liberação, reforma tributária' },
    { titulo: 'Consulta NFe no Portal Nacional', url: 'https://drive.google.com/file/d/1EOWEuamDxudh-zZzFMqHzL7WJB4oDeME/view?usp=sharing', categoria: 'Fiscal', tags: 'consulta NFe, portal nacional' },
    { titulo: 'Salvar nota no Windows', url: 'https://drive.google.com/file/d/19Pt04BklLf_4Ts8nQ6-UCGaiiQuPCoAB/view?usp=sharing', categoria: 'Fiscal', tags: 'salvar nota, XML, nota fiscal' },
    { titulo: 'Estorno de contas a pagar', url: 'https://drive.google.com/file/d/1mRSd5dL2gIg081S-Nr2XCembq6OQdvmw/view?usp=sharing', categoria: 'Financeiro', tags: 'estorno, contas a pagar' },
    { titulo: 'Nota de compra para uso e consumo', url: 'https://drive.google.com/file/d/1rEZRsVMW-ASQmYG1DfYCAJzskh8eKKlq/view?usp=sharing', categoria: 'Fiscal', tags: 'nota de compra, uso e consumo' },
    { titulo: 'Cadastro de carro', url: 'https://drive.google.com/file/d/1NQOhDpp-kuOKU4ybSLexPzTTXpVZy6s0/view?usp=sharing', categoria: 'Cadastros', tags: 'cadastro de carro, veículo' },
    { titulo: 'Como inutilizar uma nota', url: 'https://drive.google.com/file/d/13Zhj8ro2Zkx41irPrzU2OuNFayCxW4Du/view?usp=sharing', categoria: 'Fiscal', tags: 'inutilizar nota, NFe, cancelamento' },
];

function run() {
    const categoriaIdPorNome = new Map(
        db.prepare('SELECT id, nome FROM categorias_video').all().map(c => [c.nome, c.id])
    );

    const jaExiste = db.prepare('SELECT 1 FROM videos WHERE url = ? AND titulo = ?');
    const inserir = db.prepare(`INSERT INTO videos (titulo, url, tags, descricao, categoria_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)`);

    let inseridos = 0;
    for (const v of VIDEOS) {
        if (jaExiste.get(v.url, v.titulo)) continue;
        const categoriaId = categoriaIdPorNome.get(v.categoria) || null;
        inserir.run(v.titulo, v.url, v.tags, null, categoriaId, new Date().toISOString());
        inseridos++;
    }

    console.log(`Importação concluída: ${inseridos} vídeo(s) inserido(s) de ${VIDEOS.length} no total.`);
}

run();
