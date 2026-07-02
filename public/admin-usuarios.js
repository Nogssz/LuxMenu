async function api(path, opts) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Erro ${res.status}`); }
    return res.status === 204 ? null : res.json();
}

async function carregar() {
    const usuarios = await api('/api/admin/usuarios');
    document.getElementById('tbody').innerHTML = usuarios.map(u => `
        <tr>
            <td><b>${u.nome}</b></td>
            <td style="color:var(--ink-soft)">${u.username}</td>
            <td><span class="badge ${u.role}">${u.role}</span></td>
            <td><span class="badge ${u.ativo ? '' : 'inativo'}">${u.ativo ? 'ativo' : 'inativo'}</span></td>
            <td class="acoes">
                <button onclick="toggleAtivo(${u.id}, ${u.ativo})">${u.ativo ? 'desativar' : 'ativar'}</button>
                <button onclick="resetarSenha(${u.id}, '${u.nome}')">nova senha</button>
                <button class="danger" onclick="excluir(${u.id}, '${u.nome}')">excluir</button>
            </td>
        </tr>`).join('');
}

async function toggleAtivo(id, ativo) {
    try { await api(`/api/admin/usuarios/${id}/ativo`, { method: 'PATCH', body: JSON.stringify({ ativo: !ativo }) }); carregar(); }
    catch (e) { alert(e.message); }
}

async function resetarSenha(id, nome) {
    const senha = prompt(`Nova senha para ${nome}:`);
    if (!senha) return;
    try { await api(`/api/admin/usuarios/${id}/senha`, { method: 'PATCH', body: JSON.stringify({ senha }) }); alert('Senha redefinida.'); }
    catch (e) { alert(e.message); }
}

async function excluir(id, nome) {
    if (!confirm(`Excluir o usuário "${nome}"? Essa ação não pode ser desfeita.`)) return;
    try { await api(`/api/admin/usuarios/${id}`, { method: 'DELETE' }); carregar(); }
    catch (e) { alert(e.message); }
}

document.getElementById('btnAdicionar').addEventListener('click', async () => {
    const nome     = document.getElementById('nNome').value.trim();
    const username = document.getElementById('nUsername').value.trim();
    const senha    = document.getElementById('nSenha').value;
    const role     = document.getElementById('nRole').value;
    try {
        await api('/api/admin/usuarios', { method: 'POST', body: JSON.stringify({ nome, username, senha, role }) });
        document.getElementById('nNome').value = '';
        document.getElementById('nUsername').value = '';
        document.getElementById('nSenha').value = '';
        carregar();
    } catch (e) { alert(e.message); }
});

carregar();
