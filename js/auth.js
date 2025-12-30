// auth.js — manage header user display and logout
// Render the header actions depending on session state
function renderUserInHeader() {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;

    const raw = sessionStorage.getItem('currentUser');
    if (!raw) {
        // Signed-out state: show Sign in / Register buttons
        navActions.innerHTML = `
            <a href="login.html" class="btn btn-outline-secondary me-2 rounded-pill">Sign in</a>
            <a href="register.html" class="btn btn-primary rounded-pill">Register</a>
        `;
        // Ensure left-side nav links (if present) are visible when signed-out
        toggleLeftAuthLinks(false);
        return;
    }

    let user;
    try { user = JSON.parse(raw); } catch (e) { return; }

    // Signed-in state: show avatar, username and logout
    const avatarSrc = user.imageUrl || 'defAvatar.png';
    navActions.innerHTML = `
        <div class="d-flex align-items-center">
                <img id="hdrAvatar" src="${avatarSrc}" alt="avatar" class="hdr-avatar" />
                <span class="me-3">${escapeHtml(user.username)}</span>
                <button id="logoutBtn" class="btn btn-outline-secondary btn-sm rounded-pill">Logout</button>
            </div>
    `;

    // Load avatar with timeout and fallback
    const avatarEl = document.getElementById('hdrAvatar');
    if (avatarEl) loadImageWithTimeout(avatarEl, avatarSrc, 3000, 'defAvatar.png');

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (e) {
            // ignore
        }
        sessionStorage.removeItem('currentUser');
        // show signed-out header
        renderUserInHeader();
        window.location.href = 'index.html';
    });
    // Hide left-side nav "Login/Register" when signed-in
    toggleLeftAuthLinks(true);
}

// Show or hide left-side nav links that point to login/register
function toggleLeftAuthLinks(hideAuthLinks) {
    try {
        // find nav links in the left nav (commonly .nav-link) that point to login/register
        const loginLinks = document.querySelectorAll('.navbar .nav-link[href*="login.html"]');
        const registerLinks = document.querySelectorAll('.navbar .nav-link[href*="register.html"]');
        const all = [...loginLinks, ...registerLinks];
        all.forEach(a => {
            if (hideAuthLinks) {
                a.classList.add('d-none');
            } else {
                a.classList.remove('d-none');
            }
        });
    } catch (e) {
        // ignore
    }
}

// Image loader with timeout and fallback
function loadImageWithTimeout(imgEl, src, timeoutMs = 3000, fallback = 'defAvatar.png') {
    if (!imgEl) return;
    let settled = false;
    const img = new Image();
    const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        imgEl.src = fallback;
    }, timeoutMs);

    img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        imgEl.src = src;
    };
    img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        imgEl.src = fallback;
    };
    img.src = src;
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Initialize header by querying server for current session user (keeps client/sessionStorage in sync)
async function initAuthHeader() {
    try {
        const res = await fetch('/api/current', { credentials: 'same-origin' });
        if (res.ok) {
            const d = await res.json().catch(() => ({}));
            if (d && d.user) {
                sessionStorage.setItem('currentUser', JSON.stringify(d.user));
            } else {
                // ensure no stale client-side value
                sessionStorage.removeItem('currentUser');
            }
        }
    } catch (e) {
        // ignore network errors, keep client state as-is
    }
    renderUserInHeader();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthHeader);
} else {
    initAuthHeader();
}
