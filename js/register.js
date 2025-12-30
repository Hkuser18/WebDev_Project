// Registration form handling
function guid() {
    // Simple GUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getUsers() {
    try {
        const raw = localStorage.getItem('users');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveUser(user) {
    const users = getUsers();
    users.push(user);
    localStorage.setItem('users', JSON.stringify(users));
}

function usernameExists(username) {
    const users = getUsers();
    return users.some(u => u.username && u.username.toLowerCase() === username.toLowerCase());
}

function validatePassword(pw) {
    if (!pw || pw.length < 6) return false;
    const hasLetter = /[A-Za-z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);
    return hasLetter && hasNumber && hasSymbol;
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const errorsDiv = document.getElementById('registerErrors');

    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        errorsDiv.innerHTML = '';

        const username = document.getElementById('username').value.trim();
        const firstName = document.getElementById('firstName').value.trim();
        const imageUrl = document.getElementById('imageUrl').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        const errors = [];

        if (!username) errors.push('Username is required.');
        if (!firstName) errors.push('First name is required.');
        if (!imageUrl) errors.push('Image URL is required.');
        if (!password) errors.push('Password is required.');
        if (!confirmPassword) errors.push('Confirm password is required.');

        if (username && usernameExists(username)) errors.push('Username already exists. Choose another.');

        if (password && !validatePassword(password)) errors.push('Password must be at least 6 characters and include a letter, a number and a symbol.');

        if (password && confirmPassword && password !== confirmPassword) errors.push('Passwords do not match.');

        if (errors.length > 0) {
            errorsDiv.innerHTML = errors.map(e => `<div>${e}</div>`).join('');
            return;
        }

        // Create user object
        const user = {
            id: guid(),
            username: username,
            firstName: firstName,
            imageUrl: imageUrl,
            password: password
        };

        saveUser(user);

        // Redirect to login (do NOT auto-login after registration)
        window.location.href = 'login.html';
    });
});
