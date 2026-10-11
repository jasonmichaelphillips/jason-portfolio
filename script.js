const WORKER_URL = '';
let player;
let featuredVideoId;
let isLoading = false;

// Load the YouTube IFrame API for the featured video.
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function loadVideoInPlayer(videoId) {
    if (player) {
        player.loadVideoById(videoId);
        player.playVideo();
        player.mute();
        document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' });
    }
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function createVideoCards(items, container) {
    items.forEach(item => {
        const videoId = item.id || item.snippet?.resourceId?.videoId;
        const title = item.title || item.snippet?.title || 'Untitled video';
        const thumbnail = item.thumbnail_url || item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const slug = item.slug || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${videoId.toLowerCase()}`;
        const videoCard = document.createElement('a');
        videoCard.className = 'video-card';
        videoCard.href = `/videos/${encodeURIComponent(slug)}/`;
        const image = document.createElement('img');
        image.src = thumbnail;
        image.alt = title;
        image.width = 640;
        image.height = 360;
        image.loading = 'lazy';
        const info = document.createElement('div');
        info.className = 'video-info';
        const heading = document.createElement('h3');
        heading.textContent = title;
        info.appendChild(heading);
        if (item.published_at) {
            const date = document.createElement('p');
            date.textContent = formatDate(item.published_at);
            info.appendChild(date);
        }
        if (item.description) {
            const description = document.createElement('p');
            description.textContent = item.description.replace(/\s+/g, ' ').trim();
            info.appendChild(description);
        }
        videoCard.append(image, info);
        container.appendChild(videoCard);
    });
}

async function loadVideos() {
    if (isLoading) return;
    isLoading = true;
    try {
        const response = await fetch(`${WORKER_URL}/api/videos`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const videoGrid = document.getElementById('video-grid');
        let items = data.items || [];

        if (items.length > 0 && !player) {
            featuredVideoId = items[0].id || items[0].snippet?.resourceId?.videoId;
            player = new YT.Player('featured-video-player', {
                width: '100%', height: '100%', videoId: featuredVideoId,
                playerVars: { playsinline: 1, modestbranding: 1, rel: 0, autoplay: 1, controls: 1, disablekb: 0, fs: 0, iv_load_policy: 3, loop: 1, playlist: featuredVideoId, showinfo: 0, mute: 1, enablejsapi: 1 },
                events: {
                    onReady: event => { event.target.mute(); event.target.playVideo(); },
                    onStateChange: event => { if (event.data === YT.PlayerState.ENDED) player.playVideo(); }
                }
            });
            items = items.slice(1);
        }

        // The Worker renders these cards for search crawlers. This fallback keeps
        // the page usable if the API is temporarily unavailable during a deploy.
        if (videoGrid && videoGrid.children.length === 0) createVideoCards(items, videoGrid);
    } catch (error) {
        console.error('Error loading videos:', error);
        const grid = document.getElementById('video-grid');
        if (grid && grid.children.length === 0) grid.innerHTML = '<p>Video library temporarily unavailable. Please try again later.</p>';
    } finally {
        isLoading = false;
    }
}

function onYouTubeIframeAPIReady() { loadVideos(); }

document.addEventListener('DOMContentLoaded', () => {
    if (window.YT && window.YT.Player) onYouTubeIframeAPIReady();
});
