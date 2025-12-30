// login.js — validate credentials against localStorage users
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-danger mb-3';
    form.prepend(errorDiv);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        errorDiv.innerHTML = '';

        const username = document.getElementById('username')?.value?.trim() || '';
        const password = document.getElementById('password')?.value || '';

        if (!username || !password) {
            errorDiv.textContent = 'Please enter username and password.';
            return;
        }

        // Call server to authenticate
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        }).then(async (res) => {
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                errorDiv.textContent = err.error || 'Invalid username or password.';
                return;
            }
            const data = await res.json();
            if (data && data.user) {
                sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                window.location.href = 'search.html';
            } else {
                errorDiv.textContent = 'Login failed.';
            }
        }).catch(e => {
            errorDiv.textContent = 'Network error.';
        });
    });
});
