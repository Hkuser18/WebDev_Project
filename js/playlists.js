// Playlists page logic
document.addEventListener('DOMContentLoaded', () => {
    initPlaylistsPage();
});

let currentPlaylistId = null;
let currentSort = 'date'; // 'date' | 'alpha' | 'rating'

function initPlaylistsPage() {
    // Ensure logged in
    const userJson = sessionStorage.getItem('currentUser');
    if (!userJson) {
        window.location.href = 'login.html';
        return;
    }

    // Render header actions if available
    if (typeof renderUserInHeader === 'function') renderUserInHeader();

    // Wire up UI
    document.getElementById('createPlaylistForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        createNewPlaylist();
    });

    const filterInput = document.getElementById('filterInput');
    if (filterInput) filterInput.addEventListener('input', () => renderCurrentPlaylist());

    // Load playlists and render
    loadAndRenderPlaylists();
}

function getStorageUserRecord() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const allUsers = JSON.parse(localStorage.getItem('users')) || [];
    const userIndex = allUsers.findIndex(u => u.username === currentUser.username);
    const userRecord = userIndex !== -1 ? allUsers[userIndex] : null;
    return { allUsers, userRecord, userIndex };
}

function saveAllUsers(allUsers) {
    localStorage.setItem('users', JSON.stringify(allUsers));
}

function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function loadAndRenderPlaylists() {
    const { allUsers, userRecord, userIndex } = getStorageUserRecord();
    const sidebar = document.getElementById('sidebarPlaylistList');

    if (!userRecord || !userRecord.playlists || userRecord.playlists.length === 0) {
        sidebar.innerHTML = '<div class="text-center text-muted small mt-2">No playlists yet.</div>';
        showEmptyState();
        return;
    }

    // Ensure playlists have ids (migrate if needed)
    let changed = false;
    userRecord.playlists.forEach(pl => {
        if (!pl.id) { pl.id = guid(); changed = true; }
    });
    if (changed) { allUsers[userIndex] = userRecord; saveAllUsers(allUsers); }

    // Build sidebar list
    sidebar.innerHTML = '';
    userRecord.playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center playlist-item';
        item.dataset.playlistId = pl.id;

        const left = document.createElement('div');
        left.className = 'd-flex align-items-center gap-2';
        left.innerHTML = `<div><i class="bi bi-music-note-list"></i></div><div><strong>${escapeHtml(pl.name)}</strong><div class="small text-muted">${(pl.videos || []).length} songs</div></div>`;
        left.style.cursor = 'pointer';
        left.addEventListener('click', () => selectPlaylist(pl.id, true));

        const right = document.createElement('div');
        right.className = 'd-flex gap-1';
        // Play button
        const playBtn = document.createElement('button');
        playBtn.className = 'btn btn-sm btn-outline-primary';
        playBtn.title = 'Play playlist';
        playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        playBtn.addEventListener('click', (e) => { e.stopPropagation(); playPlaylist(pl.id); });

        right.appendChild(playBtn);

        item.appendChild(left);
        item.appendChild(right);
        sidebar.appendChild(item);
    });

    // Select playlist based on querystring or default to first
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('playlist');
    const findId = requestedId ? requestedId : userRecord.playlists[0].id;
    selectPlaylist(findId, false);
}

function selectPlaylist(id, pushState = true) {
    const { allUsers, userRecord } = getStorageUserRecord();
    if (!userRecord || !userRecord.playlists) return;
    const pl = userRecord.playlists.find(p => p.id === id);
    if (!pl) return;

    currentPlaylistId = id;

    // Update active class
    document.querySelectorAll('.playlist-item').forEach(el => {
        el.classList.toggle('active', el.dataset.playlistId === id);
    });

    if (pushState) {
        const newUrl = `${window.location.pathname}?playlist=${encodeURIComponent(id)}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    renderCurrentPlaylist();
}

function renderCurrentPlaylist() {
    const header = document.getElementById('playlistHeader');
    const emptyState = document.getElementById('emptyState');
    const songsContainer = document.getElementById('songsContainer');
    const filterVal = (document.getElementById('filterInput')?.value || '').toLowerCase();

    const { allUsers, userRecord } = getStorageUserRecord();
    if (!userRecord || !userRecord.playlists || !currentPlaylistId) {
        showEmptyState();
        return;
    }

    const pl = userRecord.playlists.find(p => p.id === currentPlaylistId);
    if (!pl) { showEmptyState(); return; }

    header.classList.remove('d-none');
    emptyState.classList.add('d-none');

    document.getElementById('currentPlaylistTitle').textContent = pl.name;
    document.getElementById('playlistCount').textContent = `${(pl.videos || []).length} songs`;

    // Build list of songs with filtering
    let videos = (pl.videos || []).slice();
    if (filterVal) {
        videos = videos.filter(v => (v.title || '').toLowerCase().includes(filterVal));
    }

    // Sorting
    if (currentSort === 'alpha') {
        videos.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (currentSort === 'rating') {
        videos.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else { // date
        videos.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    }

    // Render
    songsContainer.innerHTML = '';
    if (videos.length === 0) {
        songsContainer.innerHTML = '<div class="text-center text-muted p-4">No songs in this playlist.</div>';
        return;
    }

    videos.forEach(v => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex gap-3 align-items-center';

        const thumb = document.createElement('img');
        thumb.src = v.img || 'https://via.placeholder.com/120x68';
        thumb.className = 'video-list-thumb';
        thumb.addEventListener('click', () => openVideoPlayer(v.id));

        const info = document.createElement('div');
        info.className = 'flex-grow-1';
        info.innerHTML = `<div class="d-flex justify-content-between align-items-start"><div><strong>${escapeHtml(v.title || 'Untitled')}</strong><div class="small text-muted">Added ${new Date(v.dateAdded).toLocaleString()}</div></div></div>`;

        const controls = document.createElement('div');
        controls.className = 'd-flex flex-column align-items-end gap-2';

        // Rating stars
        const stars = document.createElement('div');
        stars.className = 'star-rating';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = `bi ${i <= (v.rating || 0) ? 'bi-star-fill text-warning' : 'bi-star'}`;
            star.style.cursor = 'pointer';
            star.title = `Rate ${i}`;
            star.addEventListener('click', () => rateSong(currentPlaylistId, v.id, i));
            stars.appendChild(star);
        }

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-sm btn-outline-danger rounded-pill';
        delBtn.innerHTML = '<i class="bi bi-trash"></i>';
        delBtn.title = 'Remove song';
        delBtn.addEventListener('click', () => deleteSongFromPlaylist(currentPlaylistId, v.id));

        // Play single
        const playBtn = document.createElement('button');
        playBtn.className = 'btn btn-sm btn-primary';
        playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        playBtn.title = 'Play song';
        playBtn.addEventListener('click', () => openVideoPlayer(v.id));

        const smallGrp = document.createElement('div');
        smallGrp.className = 'd-flex gap-2';
        smallGrp.appendChild(playBtn);
        smallGrp.appendChild(delBtn);

        controls.appendChild(stars);
        controls.appendChild(smallGrp);

        item.appendChild(thumb);
        item.appendChild(info);
        item.appendChild(controls);

        songsContainer.appendChild(item);
    });
}

function showEmptyState() {
    document.getElementById('playlistHeader').classList.add('d-none');
    document.getElementById('emptyState').classList.remove('d-none');
}

function createNewPlaylist() {
    const nameInput = document.getElementById('newPlaylistNameInput');
    const name = (nameInput?.value || '').trim();
    if (!name) { alert('Please enter a playlist name.'); return; }

    const { allUsers, userRecord, userIndex } = getStorageUserRecord();
    if (!userRecord) return;

    if (!userRecord.playlists) userRecord.playlists = [];
    const newPl = { id: guid(), name: name, videos: [] };
    userRecord.playlists.push(newPl);
    allUsers[userIndex] = userRecord;
    saveAllUsers(allUsers);

    // Close modal
    const modalEl = document.getElementById('createPlaylistModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    document.getElementById('createPlaylistForm').reset();

    loadAndRenderPlaylists();
    // Select new
    selectPlaylist(newPl.id, true);
}

function playPlaylist(id) {
    const { userRecord } = getStorageUserRecord();
    const pl = userRecord.playlists.find(p => p.id === id);
    if (!pl || !pl.videos || pl.videos.length === 0) {
        alert('Playlist is empty.');
        return;
    }
    openVideoPlayer(pl.videos[0].id);
}

function deleteSongFromPlaylist(playlistId, videoId) {
    if (!confirm('Remove this song from the playlist?')) return;
    const { allUsers, userRecord, userIndex } = getStorageUserRecord();
    const pl = userRecord.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    pl.videos = pl.videos.filter(v => v.id !== videoId);
    allUsers[userIndex] = userRecord; saveAllUsers(allUsers);
    renderCurrentPlaylist();
    loadAndRenderPlaylists();
}

function confirmDeletePlaylist() {
    if (!currentPlaylistId) return;
    if (!confirm('Delete this playlist and all its songs?')) return;
    const { allUsers, userRecord, userIndex } = getStorageUserRecord();
    userRecord.playlists = userRecord.playlists.filter(p => p.id !== currentPlaylistId);
    allUsers[userIndex] = userRecord; saveAllUsers(allUsers);
    currentPlaylistId = null;
    loadAndRenderPlaylists();
}

function rateSong(playlistId, videoId, rating) {
    const { allUsers, userRecord, userIndex } = getStorageUserRecord();
    const pl = userRecord.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const v = pl.videos.find(x => x.id === videoId);
    if (!v) return;
    v.rating = rating;
    allUsers[userIndex] = userRecord; saveAllUsers(allUsers);
    renderCurrentPlaylist();
}

function setSort(kind) {
    currentSort = kind;
    renderCurrentPlaylist();
}

// Video player (duplicate-safe) - uses same modal as search page
function openVideoPlayer(videoId) {
    const modalEl = document.getElementById('videoModal');
    const iframe = document.getElementById('videoPlayerFrame');
    const modal = new bootstrap.Modal(modalEl);
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => { iframe.src = ''; });
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
