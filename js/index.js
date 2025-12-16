document.addEventListener("DOMContentLoaded", () => {
    loadConfig();
});

let config = [];

async function loadConfig() {
    try {
        const response = await fetch('../config.json');
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
        authorDiv.innerHTML = `<p class="mb-2">
            Created by <a href="${githubLink}" target="_blank">${author}</a> (ID: ${authorId})</p>`;
    }
}
