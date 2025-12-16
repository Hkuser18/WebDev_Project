// auth.js — manage header user display and logout
function renderUserInHeader() {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;
    const raw = sessionStorage.getItem('currentUser');
    if (!raw) return;
    let user;
    try { user = JSON.parse(raw); } catch (e) { return; }

    // Build user display
    navActions.innerHTML = `
        <div class="d-flex align-items-center">
            <img src="${user.imageUrl}" alt="avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover;margin-right:8px;" onerror="this.src='https://via.placeholder.com/36'" />
            <span class="me-3">${user.username}</span>
            <button id="logoutBtn" class="btn btn-outline-secondary btn-sm">Logout</button>
        </div>
    `;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        // reload to update header
        window.location.href = 'index.html';
    });
}

document.addEventListener('DOMContentLoaded', () => renderUserInHeader());
