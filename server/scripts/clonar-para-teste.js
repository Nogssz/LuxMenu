const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const raiz = path.join(__dirname, '..', '..');
const origemDb = path.join(raiz, 'data', 'luxmenu.sqlite');
const origemArquivos = path.join(raiz, 'data', 'arquivos');
const destinoDir = path.join(raiz, 'data-teste');
const destinoDb = path.join(destinoDir, 'luxmenu.sqlite');
const destinoArquivos = path.join(destinoDir, 'arquivos');

async function main() {
    if (!fs.existsSync(origemDb)) {
        console.error('Banco de produção não encontrado em', origemDb);
        process.exit(1);
    }

    fs.mkdirSync(destinoDir, { recursive: true });

    // Apaga o banco de teste anterior (e os arquivos auxiliares do WAL), pra clonar do zero.
    for (const sufixo of ['', '-wal', '-shm']) {
        const arquivo = destinoDb + sufixo;
        if (fs.existsSync(arquivo)) fs.rmSync(arquivo);
    }

    console.log('Clonando banco de produção pro ambiente de teste...');
    const origem = new Database(origemDb, { readonly: true });
    await origem.backup(destinoDb); // backup online do SQLite — seguro mesmo com a produção rodando
    origem.close();

    console.log('Copiando arquivos enviados (pastas/instaladores)...');
    fs.rmSync(destinoArquivos, { recursive: true, force: true });
    if (fs.existsSync(origemArquivos)) {
        fs.cpSync(origemArquivos, destinoArquivos, { recursive: true });
    }

    console.log('Pronto! Ambiente de teste criado/atualizado em', destinoDir);
}

main();
