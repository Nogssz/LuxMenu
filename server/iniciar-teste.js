// Sobe o LuxMenu apontando pra pasta de dados de teste (data-teste/), numa porta separada
// da produção — assim dá pra testar mudanças sem nenhum risco pro banco/arquivos reais.
const path = require('path');

process.env.PORT = process.env.PORT || '3001';
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data-teste');

require('./server');
