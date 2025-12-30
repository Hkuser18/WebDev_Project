// ==========================================
// CONFIGURATION
// ==========================================

// API key will be loaded from `key.txt` at project root.
// Place your API key (plain text) in `key.txt` and the script will fetch it.
let API_KEY = "";

async function loadApiKey() {
    try {
        const res = await fetch('../key.txt');
        if (!res.ok) {
            // Try root relative path as a fallback
            const res2 = await fetch('key.txt');
            if (!res2.ok) return;
            API_KEY = (await res2.text()).trim();
            return;
        }
        API_KEY = (await res.text()).trim();
    } catch (e) {
        // network or file not found; leave API_KEY empty
        console.warn('Could not load API key from key.txt', e);
    }
}



// ==========================================
// MAIN LOGIC
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    await loadApiKey();
    checkLoginAndSetup();
    initSearchPage();
});

// 1. Auth & UI Setup
function checkLoginAndSetup() {
    const userJson = sessionStorage.getItem("currentUser");
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
    const navActions = document.getElementById("navActions");

    if (welcomeSection) {
        welcomeSection.classList.remove("d-none");
        welcomeUsername.textContent = user.username;
        // Use user image or a default placeholder
        userAvatar.src = user.image || "https://via.placeholder.com/64";
    }

    // Update Nav Button to Logout
    if (navActions) {
        navActions.innerHTML = `<button id="logoutBtn" class="btn btn-outline-danger">Logout</button>`;
        document.getElementById("logoutBtn").addEventListener("click", () => {
            sessionStorage.removeItem("currentUser");
            window.location.href = "login.html";
        });
    }
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

        // Step 1: Search Endpoint
        const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=9&q=${encodeURIComponent(query)}&type=video&key=${API_KEY}`);
        const searchData = await searchRes.json();

        if (searchData.items && searchData.items.length > 0) {
            // Step 2: Videos Endpoint (to get Duration and Views)
            const videoIds = searchData.items.map(item => item.id.videoId).join(",");
            const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${API_KEY}`);
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
        col.innerHTML = `
        <div class="card h-100 shadow-sm video-card">
            <div class="position-relative" style="cursor:pointer" onclick="openVideoPlayer('${videoId}')">
                <img src="${thumb}" class="card-img-top video-card-img-top" alt="${title}">
                <div class="position-absolute bottom-0 end-0 bg-dark text-white px-2 py-1 m-1 rounded small opacity-75">
                    ${parseDuration(content.duration)}
                </div>
                <div class="position-absolute top-50 start-50 translate-middle text-white opacity-75">
                    <i class="bi bi-play-circle-fill" style="font-size: 3rem;"></i>
                </div>
            </div>
            <div class="card-body d-flex flex-column">
                <h5 class="card-title card-title-clamp mb-1" title="${title}">${title}</h5>
                <p class="card-text text-muted small mb-2">${snippet.channelTitle}</p>
                <p class="video-stats mb-3">${formatViews(stats.viewCount)} views</p>
                
                <div class="mt-auto d-flex justify-content-between">
                    <button class="btn btn-sm btn-primary" onclick="openVideoPlayer('${videoId}')">
                        <i class="bi bi-play-fill"></i> Play
                    </button>
                    <button class="btn btn-sm ${favBtnColor}" onclick="openAddModal('${videoId}', '${title}', '${thumb}')">
                        <i class="bi ${favIcon}"></i> ${favText}
                    </button>
                </div>
            </div>
        </div>
    `;
        container.appendChild(col);
    });
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

    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    const allUsers = JSON.parse(localStorage.getItem("users")) || [];
    const userRecord = allUsers.find(u => u.username === currentUser.username);

    if (userRecord && userRecord.playlists) {
        userRecord.playlists.forEach(pl => {
            const opt = document.createElement("option");
            opt.value = pl.name;
            opt.textContent = pl.name;
            select.appendChild(opt);
        });
    }

    modal.show();
};

// C. Save Logic
function handleSaveToPlaylist() {
    const videoId = document.getElementById('modalVideoId').value;
    const title = document.getElementById('modalVideoTitle').value;
    const img = document.getElementById('modalVideoImg').value;

    const existingName = document.getElementById('existingPlaylistSelect').value;
    const newName = document.getElementById('newPlaylistName').value.trim();

    // Determine target playlist name
    let targetName = newName ? newName : existingName;

    if (!targetName) {
        alert("Please select or create a playlist.");
        return;
    }

    // Save to LocalStorage
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    const allUsers = JSON.parse(localStorage.getItem("users")) || [];
    const userIndex = allUsers.findIndex(u => u.username === currentUser.username);

    if (userIndex !== -1) {
        if (!allUsers[userIndex].playlists) allUsers[userIndex].playlists = [];

        let playlists = allUsers[userIndex].playlists;
        let targetPlaylist = playlists.find(p => p.name === targetName);

        // Create if doesn't exist
        if (!targetPlaylist) {
            targetPlaylist = { name: targetName, videos: [] };
            playlists.push(targetPlaylist);
        }

        // Add video if not duplicate
        if (!targetPlaylist.videos.some(v => v.id === videoId)) {
            targetPlaylist.videos.push({
                id: videoId,
                title: title,
                img: img,
                dateAdded: new Date().toISOString()
            });

            // Commit save
            localStorage.setItem("users", JSON.stringify(allUsers));

            // Close Modal & Reset Form
            bootstrap.Modal.getInstance(document.getElementById('addToPlaylistModal')).hide();
            document.getElementById('addToPlaylistForm').reset();

            // Show Success Toast
            new bootstrap.Toast(document.getElementById('playlistToast')).show();

            // Refresh Grid (to update the "Add" button to "Added")
            const savedState = JSON.parse(sessionStorage.getItem("lastSearchState"));
            if (savedState) renderResults(savedState.results);
        } else {
            alert("Video already in this playlist!");
        }
    }
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
