// Configuration
const CONFIG = {
    HN_API: 'https://hacker-news.firebaseio.com/v0',
    STORIES_LIMIT: 30,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// State
let state = {
    currentCategory: 'top',
    stories: [],
    cache: {},
    lastFetchTime: 0,
};

// API Functions
async function fetchStoryIds(category) {
    try {
        const endpoint = `${CONFIG.HN_API}/${category}stories.json`;
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Failed to fetch ${category} stories`);
        const ids = await response.json();
        return ids.slice(0, CONFIG.STORIES_LIMIT);
    } catch (error) {
        console.error('Error fetching story IDs:', error);
        return [];
    }
}

async function fetchStoryDetails(id) {
    // Check cache first
    if (state.cache[id] && Date.now() - state.cache[id].timestamp < CONFIG.CACHE_DURATION) {
        return state.cache[id].data;
    }

    try {
        const endpoint = `${CONFIG.HN_API}/item/${id}.json`;
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`Failed to fetch story ${id}`);
        const story = await response.json();
        
        // Cache the story
        state.cache[id] = {
            data: story,
            timestamp: Date.now(),
        };

        return story;
    } catch (error) {
        console.error(`Error fetching story ${id}:`, error);
        return null;
    }
}

async function loadStories(category) {
    state.currentCategory = category;
    showLoading(true);

    const storyIds = await fetchStoryIds(category);
    const stories = [];

    for (const id of storyIds) {
        const story = await fetchStoryDetails(id);
        if (story && story.title) {
            stories.push(story);
        }
    }

    state.stories = stories;
    renderStories();
    showLoading(false);
}

// Rendering Functions
function renderStories() {
    const container = document.getElementById('storiesContainer');
    
    if (state.stories.length === 0) {
        container.innerHTML = '<div class="empty-state"><h2>No stories found</h2></div>';
        return;
    }

    container.innerHTML = state.stories
        .map((story, index) => createStoryCard(story, index + 1))
        .join('');

    // Attach event listeners
    attachEventListeners();
}

function createStoryCard(story, rank) {
    const score = story.score || 0;
    const comments = story.descendants || 0;
    const timeAgo = formatTimeAgo(story.time);
    const author = story.by || 'Unknown';
    
    // Extract domain from URL
    let domain = '';
    if (story.url) {
        try {
            const urlObj = new URL(story.url);
            domain = urlObj.hostname.replace('www.', '');
        } catch (e) {
            domain = story.url;
        }
    }

    return `
        <article class="story-card" data-story-id="${story.id}">
            <div class="story-rank">#${rank}</div>
            <h2 class="story-title">${escapeHtml(story.title)}</h2>
            ${domain ? `<div class="story-url">${escapeHtml(domain)}</div>` : ''}
            <div class="story-meta">
                <span class="meta-item">
                    <strong>${score}</strong> point${score !== 1 ? 's' : ''}
                </span>
                <span class="meta-item">
                    by <strong>${escapeHtml(author)}</strong>
                </span>
                <span class="meta-item">
                    ${timeAgo}
                </span>
                <span class="meta-item">
                    <strong>${comments}</strong> comment${comments !== 1 ? 's' : ''}
                </span>
            </div>
            <div class="story-actions">
                ${story.url ? `<a href="${story.url}" target="_blank" rel="noopener noreferrer" class="action-btn">Open</a>` : ''}
                <a href="https://news.ycombinator.com/item?id=${story.id}" target="_blank" rel="noopener noreferrer" class="action-btn">View on HN</a>
                <button class="action-btn view-details-btn">Details</button>
            </div>
        </article>
    `;
}

function showStoryDetails(storyId) {
    const story = state.stories.find(s => s.id === storyId);
    if (!story) return;

    const modal = document.getElementById('storyModal');
    const modalBody = document.getElementById('modalBody');

    const timeAgo = formatTimeAgo(story.time);
    const score = story.score || 0;
    const comments = story.descendants || 0;
    const author = story.by || 'Unknown';

    modalBody.innerHTML = `
        <div class="modal-body-content">
            <h2 class="modal-title">${escapeHtml(story.title)}</h2>
            ${story.url ? `<a href="${story.url}" target="_blank" rel="noopener noreferrer" class="modal-link">${escapeHtml(story.url)}</a>` : ''}
            <div class="modal-meta">
                <div class="modal-meta-item">
                    <span>Score</span>
                    <strong>${score} point${score !== 1 ? 's' : ''}</strong>
                </div>
                <div class="modal-meta-item">
                    <span>Author</span>
                    <strong>${escapeHtml(author)}</strong>
                </div>
                <div class="modal-meta-item">
                    <span>Posted</span>
                    <strong>${timeAgo}</strong>
                </div>
                <div class="modal-meta-item">
                    <span>Comments</span>
                    <strong>${comments}</strong>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (show) {
        loader.style.display = 'flex';
    } else {
        loader.style.display = 'none';
    }
}

// Event Handlers
function attachEventListeners() {
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.story-card');
            const storyId = parseInt(card.dataset.storyId);
            showStoryDetails(storyId);
        });
    });

    document.querySelectorAll('.story-card').forEach(card => {
        card.addEventListener('click', () => {
            const story = state.stories.find(s => s.id === parseInt(card.dataset.storyId));
            if (story && story.url) {
                window.open(story.url, '_blank');
            }
        });
    });
}

// Modal Controls
function setupModal() {
    const modal = document.getElementById('storyModal');
    const closeBtn = document.getElementById('closeModal');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
        }
    });
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Update active state
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Load stories
            const category = link.dataset.category;
            loadStories(category);
        });
    });
}

// Utility Functions
function formatTimeAgo(unixTime) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixTime;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupModal();
    loadStories('top');
});
