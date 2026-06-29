const path = require('path');
const express = require('express');

const db = require('./db'); // garante que o banco e as tabelas existem antes de subir o servidor

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/contabilidades', require('./routes/contabilidades'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/campos', require('./routes/campos'));
app.use('/api/fechamentos', require('./routes/fechamentos'));
app.use('/api/cnpj', require('./routes/cnpj'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/categorias-video', require('./routes/categoriasVideo'));
app.use('/api/pastas', require('./routes/pastas'));
app.use('/api/arquivos', require('./routes/arquivos'));
app.use('/api/escala', require('./routes/escala'));
app.use('/api/agenda', require('./routes/agenda'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`LuxMenu rodando em http://localhost:${PORT}`);
    console.log(`Dados em: ${db.dataDir}`);
});
