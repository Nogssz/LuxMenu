// Aplica tema salvo antes do DOM carregar (evita flash)
(function () {
    const t = localStorage.getItem('luxmenu-tema');
    document.documentElement.dataset.theme = t === 'escuro' ? 'dark' : 'light';
})();

document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn');
    const erro = document.getElementById('erro');
    erro.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Entrando…';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('username').value.trim(),
                senha: document.getElementById('senha').value,
            }),
        });
        const dados = await res.json();
        if (!res.ok) { erro.textContent = dados.error || 'Erro ao entrar.'; return; }
        window.location.href = '/index.html';
    } catch {
        erro.textContent = 'Não foi possível conectar ao servidor.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
});
