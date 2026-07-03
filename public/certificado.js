const $ = (id) => document.getElementById(id);

let pfxBytes = null;
let nomeBase = 'certificado';

// ── Drag & drop / seleção de arquivo ──

const dropArea = $('dropArea');
const inputArquivo = $('inputArquivo');

dropArea.addEventListener('click', () => inputArquivo.click());
dropArea.addEventListener('dragover',  (e) => { e.preventDefault(); dropArea.classList.add('over'); });
dropArea.addEventListener('dragleave', ()  => dropArea.classList.remove('over'));
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) carregarArquivo(file);
});
inputArquivo.addEventListener('change', () => {
    if (inputArquivo.files[0]) carregarArquivo(inputArquivo.files[0]);
});

function carregarArquivo(file) {
    nomeBase = file.name.replace(/\.[^.]+$/, '');
    $('nomeArquivo').textContent = file.name;
    $('nomeArquivo').style.display = '';
    $('msgErro').style.display = 'none';
    $('resultado').style.display = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
        pfxBytes = e.target.result;
        atualizarBotao();
    };
    reader.readAsArrayBuffer(file);
}

$('senha').addEventListener('input', () => {
    atualizarBotao();
    $('msgErro').style.display = 'none';
});

$('senha').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('btnExtrair').disabled) extrair();
});

function atualizarBotao() {
    $('btnExtrair').disabled = !(pfxBytes && $('senha').value.length > 0);
}

// ── Extração ──

function mostrarErro(msg) {
    $('msgErro').textContent = msg;
    $('msgErro').style.display = 'block';
}

function formatarData(dateObj) {
    return dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pemParaBlob(pem) {
    return new Blob([pem], { type: 'text/plain' });
}

function criarDownload(conteudo, nome) {
    const url = URL.createObjectURL(pemParaBlob(conteudo));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.className = 'btn-baixar';
    a.textContent = `⬇ Baixar ${nome.split('.').pop().toUpperCase()}`;
    return { el: a, url };
}

function criarCopiar(conteudo) {
    const btn = document.createElement('button');
    btn.className = 'btn-copiar';
    btn.textContent = 'Copiar conteúdo';
    btn.addEventListener('click', async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(conteudo);
            } else {
                const ta = document.createElement('textarea');
                ta.value = conteudo; ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
            }
            btn.textContent = 'Copiado ✓'; btn.classList.add('ok');
            setTimeout(() => { btn.textContent = 'Copiar conteúdo'; btn.classList.remove('ok'); }, 2000);
        } catch { btn.textContent = 'Erro ao copiar'; }
    });
    return btn;
}

function extrair() {
    $('msgErro').style.display = 'none';
    $('resultado').style.display = 'none';
    $('btnExtrair').disabled = true;
    $('btnExtrair').textContent = 'Processando…';

    try {
        const senha = $('senha').value;

        // Converte ArrayBuffer para DER binário do forge
        const uint8 = new Uint8Array(pfxBytes);
        let binStr = '';
        for (let i = 0; i < uint8.length; i++) binStr += String.fromCharCode(uint8[i]);

        let p12;
        try {
            p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binStr), senha);
        } catch {
            try {
                p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binStr), false, senha);
            } catch {
                mostrarErro('Não foi possível abrir o certificado. Verifique se a senha está correta.');
                return;
            }
        }

        // Extrai certificados
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
        if (!certBags.length) { mostrarErro('Nenhum certificado encontrado no arquivo.'); return; }

        // Extrai chave privada
        let chavePrivada = null;
        const tiposChave = [forge.pki.oids.pkcs8ShroudedKeyBag, forge.pki.oids.keyBag];
        for (const tipo of tiposChave) {
            const bags = p12.getBags({ bagType: tipo })[tipo] || [];
            if (bags.length) { chavePrivada = bags[0].key; break; }
        }

        // Identifica certificado do titular (o que tem chave ou o primeiro leaf)
        let certTitular = certBags[0].cert;
        if (certBags.length > 1) {
            const leaf = certBags.find(b => {
                const ext = b.cert.extensions?.find(e => e.name === 'basicConstraints');
                return !ext || !ext.cA;
            });
            if (leaf) certTitular = leaf.cert;
        }

        // Gera PEM — todos os certificados da cadeia (sem chave)
        const pemCadeia = certBags.map(b => forge.pki.certificateToPem(b.cert)).join('\n');

        // Gera CRT — apenas o certificado do titular
        const pemCrt = forge.pki.certificateToPem(certTitular);

        // Gera KEY — chave privada sem criptografia
        if (!chavePrivada) { mostrarErro('Chave privada não encontrada no arquivo.'); return; }
        const pemKey = forge.pki.privateKeyToPem(chavePrivada);

        // ── Informações do certificado ──
        const sub  = certTitular.subject;
        const iss  = certTitular.issuer;
        const cn   = sub.getField('CN')?.value || '—';
        const cnpj = sub.getField({ shortName: 'CN' })?.value?.match(/(\d{14})/)?.[1] || '';
        const org  = sub.getField('O')?.value || '—';
        const emitente = iss.getField('CN')?.value || iss.getField('O')?.value || '—';
        const venc = new Date(certTitular.validity.notAfter);
        const hoje = new Date();
        const vencido = venc < hoje;
        const diasRestantes = Math.ceil((venc - hoje) / 86400000);

        $('certInfo').innerHTML = `
            <h2>Informações do certificado</h2>
            <div class="cert-linha"><span class="cert-label">Titular</span><span class="cert-val">${cn}</span></div>
            ${org !== '—' ? `<div class="cert-linha"><span class="cert-label">Organização</span><span class="cert-val">${org}</span></div>` : ''}
            <div class="cert-linha"><span class="cert-label">Emitente</span><span class="cert-val">${emitente}</span></div>
            <div class="cert-linha"><span class="cert-label">Validade</span>
                <span class="cert-val ${vencido ? 'exp-venc' : 'exp-ok'}">
                    ${formatarData(venc)}${vencido ? ' — VENCIDO' : ` — ${diasRestantes} dias restantes`}
                </span>
            </div>
        `;

        // ── Cards de download ──
        const arquivos = [
            { ext: 'pem', desc: 'Cadeia completa de certificados (sem chave privada)', conteudo: pemCadeia },
            { ext: 'crt', desc: 'Certificado do titular', conteudo: pemCrt },
            { ext: 'key', desc: 'Chave privada (não criptografada)', conteudo: pemKey },
        ];

        $('arquivosGrid').innerHTML = '';
        for (const arq of arquivos) {
            const card = document.createElement('div');
            card.className = 'arquivo-card';
            const { el: btnBaixar } = criarDownload(arq.conteudo, `${nomeBase}.${arq.ext}`);
            const btnCopiar = criarCopiar(arq.conteudo);
            card.innerHTML = `<h3>.${arq.ext}</h3><p>${arq.desc}</p>`;
            card.appendChild(btnBaixar);
            card.appendChild(btnCopiar);
            $('arquivosGrid').appendChild(card);
        }

        $('resultado').style.display = '';

    } catch (e) {
        mostrarErro('Erro inesperado ao processar o certificado: ' + e.message);
    } finally {
        $('btnExtrair').disabled = false;
        $('btnExtrair').textContent = 'Extrair arquivos';
    }
}

$('btnExtrair').addEventListener('click', extrair);
