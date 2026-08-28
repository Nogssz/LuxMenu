# LuxMenu

Ferramenta interna da Lux Sistemas — não confundir com o **LuxAuto** (o ERP que a
empresa vende pros clientes, "Lux Gerencial"/"LUX2026"). O LuxMenu é um painel à
parte, construído sob medida, que dá suporte ao trabalho da equipe: cadastro de
clientes/contabilidades, fechamentos mensais, escala de plantão, agenda/tarefas,
chat interno, extração de certificado digital, e a central de vídeos tutoriais
usada pra treinar clientes do LuxAuto.

## Stack

- **Backend**: Node.js + Express 5, `better-sqlite3` (SQLite síncrono), sessão via
  `express-session` com store próprio em SQLite (`server/session-store.js`).
- **Frontend**: HTML/CSS/JS puro, sem framework nem bundler. Cada página é um par
  `arquivo.html` + `arquivo.js` solto em `public/`. Busca usa `fuse.js`.
- **WebSocket**: `express-ws`, usado pelo chat interno (`ws-chat.js`) e por
  atualizações ao vivo do módulo de fechamento (`ws-fechamento.js`).
- **OCR**: `tesseract.js`, usado só no diagnóstico de erro por print (ver abaixo).

Sem build step — os arquivos em `public/` são servidos direto (`express.static`).

## Rodando localmente

```
npm install
npm start          # node server/server.js, porta 3000 (PORT env var pra mudar)
npm run start:teste  # ambiente de teste isolado, porta 3001, banco em data-teste/
```

Depois de qualquer `git push` pra produção, **sempre reiniciar o processo**: achar
o PID na porta 3000 (`netstat -ano | grep :3000`), matar, subir de novo
(`node server/server.js` em background), confirmar com `curl` que voltou a
responder. Isso é hábito estabelecido — fazer sem precisar que peçam.

## Banco de dados

SQLite em `data/luxmenu.sqlite` (fica em `data/`, que é **gitignored** — tem dado
real de cliente, nunca versionar). `DATA_DIR` env var muda o caminho (usado pelo
ambiente de teste).

Migrations em `server/migrations/*.sql`, numeradas e aplicadas em ordem automaticamente
no boot (`server/db.js` lê a pasta, roda o que ainda não tá na tabela `_migrations`).
Pra mudar o schema: criar um arquivo novo numerado (ex: `019_algo.sql`), nunca editar
uma migration antiga que já rodou em produção.

Tabelas principais: `usuarios` (equipe, login com bcrypt), `sessoes`, `contabilidades`
e `clientes` (com `cliente_campo_valores`/`campos_customizados` — sistema de campos
dinâmicos por cliente, **preferir esse padrão a colunas fixas novas**), `fechamentos_mensais`,
`pessoas_escala`/`escala_sabados`, `agenda_compromissos`/`agenda_tarefas` (kanban por
pessoa, com urgência), `mensagens`/`chat_arquivos` (chat), `videos`/`categorias_video`
(+ índice FTS5 em `videos_fts` pra busca).

## Autenticação

- `authHtml` (middleware) protege toda página `*.html` exceto `login.html` — redireciona
  pro login se não tiver sessão. Novo arquivo `.html` já nasce protegido, não precisa
  registrar em lugar nenhum.
- `requireAuth` protege rotas de API por sessão de navegador (cookie). Usado em quase
  tudo em `/api/*`.
- **Exceção**: `/api/erro-conhecido` é pública de propósito — quem chama é o LuxAuto
  (aplicação externa), não um navegador logado. Só devolve link de vídeo público, não
  expõe nada sensível.
- Senha de sessão (`SESSION_SECRET`) tem um valor fraco fixo como reserva no código —
  em produção isso **precisa** ser definido como variável de ambiente com um valor forte
  gerado (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

## O sistema de vídeos tutoriais (a parte mais construída/ativa)

Existem **três superfícies diferentes**, cada uma com um propósito:

1. **`public/videos.html`** — ferramenta interna pra equipe. Lista simples com busca
   (Fuse.js), CRUD de vídeo, categorias, e uma seção "Fluxo do processo" que casa vídeos
   pelo *título exato* (Orçamento → OS → NFe). Também tem uma caixa fixa com o link do
   site público (item 2) pra copiar e mandar pro cliente.

2. **`docs/videos/`** — site estático simples, publicado via GitHub Pages **nesse mesmo
   repositório** (branch main, pasta /docs). Busca client-side contra um `videos.json`
   gerado por `node server/seed/export_videos_estaticos.js` (rodar esse script e commitar
   o JSON sempre que a lista de vídeo mudar). URL pública:
   `https://luxsistemas.github.io/Lux-Menu/videos/`.

3. **`public/videos-navegar.html` + `docs/tutoriais/`** — o protótipo mais rico e o
   que está em desenvolvimento ativo. Detalhes na seção seguinte.

### Navegação por menu (`videos-navegar`)

Em vez de só buscar por palavra-chave, o cliente navega pela **mesma estrutura de menu
do LuxAuto de verdade** (replicada à mão em `MENU_RETAGUARDA`/`MENU_PDV` dentro do JS —
visual verde/escuro parecido com o sistema real, incluindo alternância entre "Retaguarda"
e "PDV" igual o botão de cima do LuxAuto).

Cada tela do menu (nó tipo `'pessoas>contatos'`) pode ter até 4 categorias de vídeo, nessa
ordem de exibição:

```
geral        → Visão geral (primeiro vídeo que um cliente novo assiste)
essenciais   → Funções importantes / específicas
erros        → Erros comuns
avancado     → Dicas avançadas
```

Um nó também pode ter uma `nota` (aviso destacado em amarelo no topo da tela) —
usado hoje só em Compras → Consulta Notas de Fornecedor, explicando quando usar
importação automática vs. chave de acesso.

**Existem DOIS arquivos quase idênticos** que precisam ficar sincronizados manualmente:

- `public/videos-navegar.js` — versão completa, atrás de login, busca vídeo via
  `/api/videos`, e tem a busca por print de erro (OCR).
- `docs/tutoriais/app.js` — versão estática pro cliente, sem login, busca vídeo de um
  `videos.json` local, **sem** a parte de OCR (depende de servidor rodando, que os
  clientes não têm acesso). Publicada num **repositório GitHub separado**
  (`LuxSistemas/Tutoriais`, remote `tutoriais`), via:

  ```
  git subtree push --prefix=docs/tutoriais tutoriais main
  ```

  URL pública: `https://luxsistemas.github.io/Tutoriais/`.

**Toda vez que um vídeo novo é cadastrado ou o menu muda**, repetir em ambos os lugares:
1. Inserir o vídeo na tabela `videos` (via `node -e` direto ou pela tela admin).
2. Atualizar o mapeamento (`VIDEOS_RETAGUARDA`/`VIDEOS_PDV`) nos dois arquivos JS.
3. Regenerar os dois `videos.json` (`docs/videos/` e `docs/tutoriais/`).
4. Commit + push nos três remotes do LuxMenu + `git subtree push` pro repo `tutoriais`.
5. Reiniciar o servidor de produção.

### Diagnóstico de erro (OCR + integração direta)

Dois jeitos do cliente achar o vídeo certo pra um erro do LuxAuto, **os dois convivem,
um não substitui o outro**:

- **Por print** (`POST /api/ocr-erro`, autenticado): cliente cola/arrasta um print do
  erro na tela do `videos-navegar`. Servidor lê o texto com Tesseract (`server/routes/ocr-erro.js`)
  e bate contra `server/erros-conhecidos.js`.
- **Direto do LuxAuto** (`POST /api/erro-conhecido`, pública): pensado pra ser chamado de
  dentro do próprio LuxAuto (o time que mantém o ERP ainda vai integrar isso, botão
  "Ver como resolver" na caixa de erro nativa) — manda o **código de rejeição da SEFAZ**
  (ex: `232`, muito mais confiável que casar texto) e/ou o texto, recebe o(s) vídeo(s).

Os dois usam a mesma lista central `server/erros-conhecidos.js` (`ERROS_CONHECIDOS`,
cada item com `codigo` SEFAZ opcional + função `bate(texto)` + `videoIds`). Pra mapear
um erro novo: adicionar uma entrada ali com o vídeo já cadastrado na tabela `videos`.

Cache de idioma do Tesseract fica em `data/tesseract-cache/` (dentro da pasta gitignored,
não polui a raiz do projeto — isso já foi um bug corrigido, cuidado se mexer no
`createWorker`).

## Git — três remotes + um extra

```
origin       Nogssz/LuxMenu.git        (fork pessoal do Gabriel)
empresa      Lux-Sistemas/LuxMenu.git  (repo da empresa — preferir clonar daqui em produção)
luxsistemas  LuxSistemas/Lux-Menu.git  (mesmo conteúdo, nome de org diferente)
tutoriais    LuxSistemas/Tutoriais.git (site do cliente, só docs/tutoriais/ via subtree)
```

Os três primeiros ficam sempre sincronizados — depois de commitar, **push nos três**.
`tutoriais` é diferente: só recebe o subdiretório `docs/tutoriais/` como raiz, via
`git subtree push --prefix=docs/tutoriais tutoriais main`, e só quando esse subdiretório
mudar.

Branch única: `main`, sem PRs — commit direto.

## Convenções

- Comentário só quando explica um "porquê" não óbvio (bug já corrigido, decisão de
  design contra-intuitiva). Não narra o que o código faz.
- Nomes de variável/função em português, junto com o resto do código.
- Delegação de evento no padrão `document.body.addEventListener('click', e => { const x =
  e.target.closest('.classe'); if (x) {...} })`, não listener por elemento.
- `escapeHtml`/`normalizarTexto` (tira acento pra busca) são pequenas e ficam duplicadas
  em cada arquivo JS que precisa — de propósito, pra cada bundle continuar deployável
  sozinho (principalmente `docs/tutoriais/app.js`, que não pode depender de módulo
  compartilhado com o resto do projeto).
- Ao adicionar tela nova (`.html`), nada especial precisa ser feito pra ela ficar
  protegida por login — `authHtml` já cobre qualquer `*.html` automaticamente.

## Migração pra VPS (em andamento)

Hoje roda numa máquina Windows local, acesso por IP de rede local (LAN) + Radmin VPN
pra acesso remoto da equipe. Migração planejada pra um Windows Server com IP público
próprio (sem domínio ainda). Pontos que mudam nessa migração:
- `SESSION_SECRET` precisa de valor forte de verdade (ver seção Autenticação).
- Pasta `data/` precisa ser copiada manualmente pro servidor novo (não vai por git).
- Rodar como Serviço do Windows (NSSM ou similar) em vez de processo solto no terminal,
  pra sobreviver a reinício/crash.
- `docs/tutoriais` e `docs/videos` (GitHub Pages) não são afetados pela migração — só
  o LuxMenu em si muda de endereço.
