const fs = require('fs');
const path = require('path');
const db = require('../db');

// O CSV exportado chegou com acentos corrompidos (mojibake) em alguns trechos
// — bytes UTF-8 que foram perdidos na cópia. Os casos identificados manualmente
// são corrigidos aqui antes do parse; o restante do texto já está correto.
const CORRECOES_TEXTO = [
    ['RESPONSÃVEL', 'RESPONSÁVEL'],
    ['terÃ§a', 'terça'],
    ['HeloÃ­sa', 'Heloísa'],
    ['DÃ©bora', 'Débora'],
    ['TAMBÃM', 'TAMBÉM'],
    ['DO MÃS', 'DO MÊS'],
    ['BANCÃRIA', 'BANCÁRIA'],
    ['CONFECÃÃES', 'CONFECÇÕES'],
    ['VITÃRIA', 'VITÓRIA'],
    ['SERVIÃOS', 'SERVIÇOS'],
    ['AlumÃ­nios', 'Alumínios'],
    ['DoÃ§ura', 'Doçura'],
    ['CONSTRUÃÃES', 'CONSTRUÇÕES'],
    ['DÃBORA', 'DÉBORA'],
    ['LÃª', 'Lê'],
    ['lÃª', 'lê'],
    ['estÃ©tica', 'estética'],
    ['ESTÃ OK', 'ESTÁ OK'],
    ['LÃ NO ENVIO', 'LÁ NO ENVIO'],
    ['MECÃNICA', 'MECÂNICA'],
    ['nÃ£o', 'não'],
    ['PÃ£o', 'Pão'],
    ['RELATÃRIO', 'RELATÓRIO'],
    ['MONOFÃSICO', 'MONOFÁSICO'],
    ['SUSPENSÃES', 'SUSPENSÕES'],
    ['ÃPTICA', 'ÓPTICA'],
    ['Ã© a xv', 'é a xv'],
];

function corrigirMojibake(texto) {
    let resultado = texto;
    for (const [de, para] of CORRECOES_TEXTO) resultado = resultado.split(de).join(para);
    return resultado;
}

function parseCsv(texto) {
    const linhas = [];
    let linha = [];
    let campo = '';
    let aspas = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (aspas) {
            if (c === '"') {
                if (texto[i + 1] === '"') { campo += '"'; i++; } else { aspas = false; }
            } else {
                campo += c;
            }
            continue;
        }
        if (c === '"') { aspas = true; continue; }
        if (c === ',') { linha.push(campo); campo = ''; continue; }
        if (c === '\r') continue;
        if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
        campo += c;
    }
    if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.filter(l => l.some(c => c.trim() !== ''));
}

const MES_IMPORTACAO = 6;
const ANO_IMPORTACAO = 2026;

function run() {
    const csvPath = path.join(__dirname, 'DB_CLIENTES.csv');
    const textoOriginal = fs.readFileSync(csvPath, 'utf8');
    const linhas = parseCsv(corrigirMojibake(textoOriginal));
    const [, ...dados] = linhas; // descarta o header

    const contabilidadeIdPorNome = new Map();
    const buscarOuCriarContabilidade = (nome, email) => {
        const chave = nome.trim().toLowerCase();
        if (contabilidadeIdPorNome.has(chave)) return contabilidadeIdPorNome.get(chave);

        let row = db.prepare('SELECT id FROM contabilidades WHERE nome = ?').get(nome.trim());
        if (!row) {
            const info = db.prepare('INSERT INTO contabilidades (nome, email) VALUES (?, ?)')
                .run(nome.trim(), email ? email.trim() : null);
            row = { id: info.lastInsertRowid };
        }
        contabilidadeIdPorNome.set(chave, row.id);
        return row.id;
    };

    const insertCliente = db.prepare(`INSERT INTO clientes (nome, cnpj, responsavel, contato, obs, contabilidade_id)
                                       VALUES (?, ?, ?, ?, ?, ?)`);
    const insertFechamento = db.prepare(`INSERT INTO fechamentos_mensais (cliente_id, mes, ano, feito, marcado_em)
                                          VALUES (?, ?, ?, ?, ?)`);

    let importados = 0;
    let semNome = 0;

    const transacao = db.transaction(() => {
        for (const col of dados) {
            const nome = (col[1] || '').trim();
            if (!nome) { semNome++; continue; }

            const cnpj = (col[2] || '').trim() || null;
            const responsavel = (col[3] || '').trim() || null;
            const contato = (col[4] || '').trim() || null;
            const obs = (col[5] || '').trim() || null;
            const contabilidadeNome = (col[6] || '').trim();
            const contabilidadeEmail = (col[7] || '').trim();
            const feitoStr = (col[8] || '').trim().toUpperCase();

            const contabilidadeId = contabilidadeNome ? buscarOuCriarContabilidade(contabilidadeNome, contabilidadeEmail) : null;

            const info = insertCliente.run(nome, cnpj, responsavel, contato, obs, contabilidadeId);
            importados++;

            if (feitoStr === 'TRUE' || feitoStr === 'FALSE') {
                insertFechamento.run(info.lastInsertRowid, MES_IMPORTACAO, ANO_IMPORTACAO, feitoStr === 'TRUE' ? 1 : 0, new Date().toISOString());
            }
        }
    });

    transacao();

    console.log(`Importação concluída: ${importados} clientes, ${contabilidadeIdPorNome.size} contabilidades.`);
    if (semNome) console.log(`${semNome} linha(s) ignorada(s) por não ter nome de cliente.`);
}

run();
