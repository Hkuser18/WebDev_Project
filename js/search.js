// ==========================================
// CONFIGURATION
// ==========================================

// API key will be loaded from `key.txt` at project root.
// Place your API key (plain text) in `key.txt` and the script will fetch it.
let API_KEY = "";

async function loadApiKey() {
    try {
        let res = null;
        try {
            res = await fetchWithTimeout('../key.txt', { timeout: 3000 });
        } catch (e) {
            // fallback to root
            res = await fetchWithTimeout('key.txt', { timeout: 3000 }).catch(() => null);
        }
        if (res && res.ok) {
            API_KEY = (await res.text()).trim();
        }
    } catch (e) {
        // network or file not found; leave API_KEY empty
        console.warn('Could not load API key from key.txt', e);
    }
}

// Helper: fetch with timeout
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// Small GUID generator for playlist IDs
function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Image loader with timeout and fallback (for avatars)
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



// ==========================================
// MAIN LOGIC
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    await loadApiKey();
    await checkLoginAndSetup();
    initSearchPage();
});

// 1. Auth & UI Setup
async function checkLoginAndSetup() {
    let userJson = sessionStorage.getItem("currentUser");
    if (!userJson) {
        try {
            const res = await fetch('/api/current', { credentials: 'same-origin' });
            if (res.ok) {
                const d = await res.json().catch(() => ({}));
                if (d && d.user) {
                    sessionStorage.setItem('currentUser', JSON.stringify(d.user));
                    userJson = sessionStorage.getItem('currentUser');
                }
            }
        } catch (e) {
            // ignore
        }
    }

    // Redirect if not logged in
    if (!userJson) {
        window.location.href = "login.html";
        return;
    }

    const user = JSON.parse(userJson);

    // Update Welcome UI
    const welcomeSection = document.getElementById("welcomeSection");
    const welcomeUsername = document.getElementById("welcomeUsername");
    const userAvatar = document.getElementById("userAvatar");

    if (welcomeSection) {
        welcomeSection.classList.remove("d-none");
        welcomeUsername.textContent = user.username;
        // Use user.imageUrl or legacy user.image, fallback to default
        const avatarSrc = user.imageUrl || user.image || 'defAvatar.png';
        loadImageWithTimeout(userAvatar, avatarSrc, 3000, 'defAvatar.png');
    }

    // Let auth.js render the header actions (signed-in/out) consistently
    if (typeof renderUserInHeader === 'function') renderUserInHeader();
}

// 2. Search Initialization
function initSearchPage() {
    const searchForm = document.getElementById("searchForm");
    const searchInput = document.getElementById("searchInput");
    const saveBtn = document.getElementById("saveToPlaylistBtn");

    // A. Handle URL Query Params (Deep linking)
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get("q");

    // B. Check for Saved State (Back button support)
    const savedState = sessionStorage.getItem("lastSearchState");

    if (queryParam) {
        searchInput.value = queryParam;

        // If state exists and matches query, use it to avoid API cost
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.query === queryParam) {
                renderResults(state.results);
            } else {
                executeSearch(queryParam);
            }
        } else {
            executeSearch(queryParam);
        }
    }

    // C. Handle Form Submit
    searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            // Update URL without reloading
            const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
            window.history.pushState({ path: newUrl }, '', newUrl);
            executeSearch(query);
        }
    });

    // D. Attach Modal Save Event
    if (saveBtn) {
        saveBtn.addEventListener("click", handleSaveToPlaylist);
    }
}

// 3. Execute Search (Router for Mock vs Real)
async function executeSearch(query) {
    const spinner = document.getElementById("loadingSpinner");
    const container = document.getElementById("resultsContainer");

    container.innerHTML = ""; // Clear previous
    spinner.classList.remove("d-none");

    if (!API_KEY) {
        spinner.classList.add('d-none');
        container.innerHTML = `<div class="alert alert-warning w-100">Missing API key. Please add your YouTube API key to <code>key.txt</code> in the project root.</div>`;
        return;
    }

    try {
        let items = [];

        // Step 1: Search Endpoint (use fetchWithTimeout)
        const searchRes = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=9&q=${encodeURIComponent(query)}&type=video&key=${API_KEY}`, { timeout: 8000 });
        const searchData = await searchRes.json();

        if (searchData.items && searchData.items.length > 0) {
            // Step 2: Videos Endpoint (to get Duration and Views)
            const videoIds = searchData.items.map(item => item.id.videoId).join(",");
            const detailsRes = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${API_KEY}`, { timeout: 8000 });
            const detailsData = await detailsRes.json();
            items = detailsData.items;
        }

        // Save State
        sessionStorage.setItem("lastSearchState", JSON.stringify({ query: query, results: items }));

        renderResults(items);

    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="alert alert-danger w-100">Search failed. Please try again later.</div>`;
    } finally {
        spinner.classList.add("d-none");
    }
}

// 4. Render Results
function renderResults(videos) {
    const container = document.getElementById("resultsContainer");

    // Always clear existing results to avoid duplicates when re-rendering
    container.innerHTML = "";

    // Get current user playlists to check favorites status
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    const allUsers = JSON.parse(localStorage.getItem("users")) || [];
    const userRecord = allUsers.find(u => u.username === currentUser.username);
    const userPlaylists = userRecord ? (userRecord.playlists || []) : [];

    if (!videos || videos.length === 0) {
        container.innerHTML = `<div class="col-12 text-center text-muted">No results found.</div>`;
        return;
    }

    videos.forEach(video => {
        const snippet = video.snippet;
        const stats = video.statistics || { viewCount: 0 };
        const content = video.contentDetails || { duration: "N/A" };

        const videoId = typeof video.id === 'string' ? video.id : video.id.videoId;
        const title = escapeHtml(snippet.title);
        const thumb = snippet.thumbnails.medium.url;

        // Check if video is in ANY of the user's playlists
        let isFavorite = false;
        userPlaylists.forEach(pl => {
            if (pl.videos && pl.videos.some(v => v.id === videoId)) isFavorite = true;
        });

        // UI Logic for Favorites button
        const favIcon = isFavorite ? "bi-check-lg" : "bi-heart";
        const favBtnColor = isFavorite ? "btn-secondary" : "btn-outline-danger";
        const favText = isFavorite ? "Added" : "Add";

        // Create Card HTML
        const col = document.createElement("div");
        col.className = "col";
        // tag the column so we can refresh only this card after adding to playlist
        col.dataset.videoId = videoId;
        col.innerHTML = `
        <div class="card h-100 shadow-sm video-card">
            <div class="position-relative clickable">
                <img src="${thumb}" class="card-img-top video-card-img-top" alt="${title}">
                <div class="position-absolute bottom-0 end-0 bg-dark text-white px-2 py-1 m-1 rounded small opacity-75">
                    ${parseDuration(content.duration)}
                </div>
                <div class="position-absolute top-50 start-50 translate-middle text-white opacity-75">
                    <i class="bi bi-play-circle-fill play-icon"></i>
                </div>
            </div>
            <div class="card-body d-flex flex-column">
                <h5 class="card-title card-title-clamp mb-1" title="${title}">${title}</h5>
                <p class="card-text text-muted small mb-2">${snippet.channelTitle}</p>
                <p class="video-stats mb-3">${formatViews(stats.viewCount)} views</p>
                
                <div class="mt-auto d-flex justify-content-between">
                    <button class="btn btn-sm btn-primary play-btn">
                        <i class="bi bi-play-fill"></i> Play
                    </button>
                    <button class="btn btn-sm ${favBtnColor} fav-btn" data-video-id="${videoId}">
                        <i class="bi ${favIcon}"></i> ${favText}
                    </button>
                </div>
            </div>
        </div>
    `;
        container.appendChild(col);

        // Attach event listeners safely (avoid inline onclick with quoted args)
        try {
            const clickable = col.querySelector('.clickable');
            if (clickable) clickable.addEventListener('click', () => openVideoPlayer(videoId));

            const playBtn = col.querySelector('.play-btn');
            if (playBtn) playBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openVideoPlayer(videoId); });

            const favBtnEl = col.querySelector('.fav-btn');
            if (favBtnEl) favBtnEl.addEventListener('click', (ev) => { ev.stopPropagation(); openAddModal(videoId, snippet.title, thumb); });
        } catch (e) {
            console.warn('attach listeners error', e);
        }
    });
}

// Refresh a single video's favorite/add button after playlist changes
function refreshVideoCard(videoId) {
    try {
        const container = document.getElementById('resultsContainer');
        const col = container.querySelector(`[data-video-id="${videoId}"]`);
        if (!col) return;
        const btn = col.querySelector('.fav-btn');
        if (!btn) return;
        // Ask server whether video is present in any playlist
        fetch('/api/playlists', { credentials: 'same-origin' }).then(async (res) => {
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            const pls = data.playlists || [];
            let isFavorite = false;
            pls.forEach(pl => { if (pl.videos && pl.videos.some(v => v.id === videoId)) isFavorite = true; });
            const favIcon = isFavorite ? 'bi-check-lg' : 'bi-heart';
            const favBtnColor = isFavorite ? 'btn-secondary' : 'btn-outline-danger';
            const favText = isFavorite ? 'Added' : 'Add';
            btn.className = `btn btn-sm ${favBtnColor} fav-btn`;
            btn.innerHTML = `<i class="bi ${favIcon}"></i> ${favText}`;
        }).catch(() => { });
    } catch (e) {
        console.warn('refreshVideoCard error', e);
    }
}

// 5. Modal Logic

// A. Video Player
window.openVideoPlayer = function (videoId) {
    const modalEl = document.getElementById('videoModal');
    const iframe = document.getElementById('videoPlayerFrame');
    const modal = new bootstrap.Modal(modalEl);

    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => {
        iframe.src = ""; // Stop audio when closed
    });
};

// B. Add to Playlist Modal
window.openAddModal = function (id, title, img) {
    const modal = new bootstrap.Modal(document.getElementById('addToPlaylistModal'));

    // Set Hidden Inputs
    document.getElementById('modalVideoId').value = id;
    document.getElementById('modalVideoTitle').value = title;
    document.getElementById('modalVideoImg').value = img;

    // Populate "Existing Playlists" dropdown
    const select = document.getElementById('existingPlaylistSelect');
    select.innerHTML = '<option value="" selected disabled>Choose...</option>';
    // Load playlists from server to populate dropdown
    fetch('/api/playlists', { credentials: 'same-origin' }).then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const pls = data.playlists || [];
        pls.forEach(pl => {
            const opt = document.createElement('option');
            opt.value = pl.id;
            opt.textContent = pl.name;
            select.appendChild(opt);
        });
    }).catch(() => { /* ignore */ });

    modal.show();
};

// C. Save Logic
function handleSaveToPlaylist() {
    const videoId = document.getElementById('modalVideoId').value;
    const title = document.getElementById('modalVideoTitle').value;
    const img = document.getElementById('modalVideoImg').value;

    const existingValue = document.getElementById('existingPlaylistSelect').value;
    const newName = document.getElementById('newPlaylistName').value.trim();

    if (!existingValue && !newName) {
        alert("Please select or create a playlist.");
        return;
    }
    // If new playlist name provided, create playlist first
    (async () => {
        try {
            let targetId = existingValue;
            if (!targetId && newName) {
                const res = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
                if (!res.ok) throw new Error('Could not create playlist');
                const data = await res.json();
                targetId = data.playlist.id;
            }
            // Check for MP3 upload
            const uploadInput = document.getElementById('uploadMp3File');
            let videoPayload = { id: videoId, title: title, img: img, type: 'youtube' };
            if (uploadInput && uploadInput.files && uploadInput.files.length > 0) {
                // upload file first
                const file = uploadInput.files[0];
                const formData = new FormData();
                formData.append('file', file);
                const upRes = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'same-origin' });
                if (!upRes.ok) throw new Error('Upload failed');
                const upData = await upRes.json();
                // create a new video-like entry representing the mp3
                const mp3Id = guid();
                videoPayload = { id: mp3Id, title: file.name, img: '', type: 'mp3', src: upData.url };
            }

            // Now add to playlist
            const addRes = await fetch(`/api/playlists/${encodeURIComponent(targetId)}/add`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video: videoPayload }) });
            if (!addRes.ok) {
                const e = await addRes.json().catch(() => ({}));
                alert(e.error || 'Could not add to playlist');
                return;
            }

            // Close Modal & Reset Form
            bootstrap.Modal.getInstance(document.getElementById('addToPlaylistModal')).hide();
            document.getElementById('addToPlaylistForm').reset();

            // Show Success Toast
            new bootstrap.Toast(document.getElementById('playlistToast')).show();

            // Refresh only the card for this video so results are not duplicated
            refreshVideoCard(videoId);
        } catch (e) {
            alert('Could not save to playlist');
        }
    })();
}

// 6. Helpers
function formatViews(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

function parseDuration(iso) {
    if (!iso || iso === "N/A") return "0:00";
    const match = iso.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return "0:00";

    const h = (match[1] || '').replace('H', '');
    const m = (match[2] || '').replace('M', '');
    const s = (match[3] || '').replace('S', '');

    let res = "";
    if (h) res += h + ":";
    res += (m || "0") + ":";
    res += (s.length === 1 ? "0" + s : (s || "00"));
    return res;
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
