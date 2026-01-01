document.addEventListener("DOMContentLoaded", () => {
    loadConfig();
});

let config = [];

async function loadConfig() {
    try {
        if (typeof INJECTED_CONFIG !== 'undefined' && INJECTED_CONFIG) {
            config = INJECTED_CONFIG;
            pageLoaded();
            return;
        }
        // Use a timed fetch so config load won't hang
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const response = await fetch('../config.json', { signal: controller.signal });
        clearTimeout(id);
        config = await response.json();
        pageLoaded();
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

let authorDiv = document.getElementById("hero_div");

function pageLoaded() {
    if (config && config.length > 0) {
        let author = config[0].AUTHOR;
        let githubLink = config[0].github_link;
        let authorId = config[0].ID;
        let projectName = config[0].PROJECT_NAME || 'Project';
        let projectDesc = config[0].PROJECT_DESC || '';

        authorDiv.innerHTML = `
            <div class="d-flex flex-column flex-md-row align-items-center justify-content-between">
                <div class="flex-grow-1">
                    <h2 class="mb-2">${projectName}</h2>
                    ${projectDesc ? `<p class="lead mb-3">${projectDesc}</p>` : ''}
                    <p class="mb-2">Created by <a href="${githubLink}" target="_blank">${author}</a></p>
                    <p class="text-muted mb-3">ID: <code>${authorId}</code></p>
                    <a href="${githubLink}" target="_blank" class="btn btn-outline-secondary btn-github me-2"><i class="bi bi-github"></i> View on GitHub</a>
                </div>
                <div class="mt-3 mt-md-0 text-center hero-avatar">
                    <i class="bi bi-person-circle hero-icon"></i>
                </div>
            </div>
        `;
    }
}
