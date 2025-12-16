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

        let users = [];
        try { users = JSON.parse(localStorage.getItem('users')) || []; } catch (e) { users = []; }

        const matched = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase() && u.password === password);

        if (!matched) {
            errorDiv.textContent = 'Invalid username or password.';
            return;
        }

        // set currentUser in sessionStorage (without password)
        const safeUser = { id: matched.id, username: matched.username, firstName: matched.firstName, imageUrl: matched.imageUrl };
        sessionStorage.setItem('currentUser', JSON.stringify(safeUser));

        // redirect to search page
        window.location.href = 'search.html';
    });
});
