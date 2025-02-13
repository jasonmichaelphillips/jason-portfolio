const CHANNEL_ID = 'UCgR5VYHYy-u_HIiimcYQOMA';
const WORKER_URL = 'https://youtubeworker.wickedshrapnel.workers.dev';
let nextPageToken = '';
let isMuted = false; // Set to false to start unmuted

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let featuredVideoId;

function loadVideoInPlayer(videoId) {
    if (player) {
        player.loadVideoById(videoId);
        player.playVideo();
        if (!isMuted) {
            player.unMute();
        }
        document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
    }
}

function createVideoCards(items, container) {
    items.forEach(item => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="${item.snippet.thumbnails.high.url}" alt="${item.snippet.title}" loading="lazy">
            <div class="video-info">
                <h3>${item.snippet.title}</h3>
            </div>
        `;
        videoCard.addEventListener('click', () => {
            loadVideoInPlayer(item.id.videoId);
        });
        container.appendChild(videoCard);
    });
}

async function loadMoreVideos() {
    try {
        const loadMoreButton = document.getElementById('load-more');
        loadMoreButton.textContent = 'Loading...';
        loadMoreButton.disabled = true;

        const response = await fetch(`${WORKER_URL}/api/videos?pageToken=${nextPageToken}`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const videoGrid = document.getElementById('video-grid');
            createVideoCards(data.items, videoGrid);
            
            nextPageToken = data.nextPageToken;
            
            if (!nextPageToken) {
                loadMoreButton.parentElement.remove();
            } else {
                loadMoreButton.textContent = 'Load More Videos';
                loadMoreButton.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error:', error);
        const loadMoreButton = document.getElementById('load-more');
        loadMoreButton.textContent = 'Error Loading More Videos';
        loadMoreButton.disabled = true;
    }
}

async function initializePage() {
    try {
        const response = await fetch(`${WORKER_URL}/api/videos`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        nextPageToken = data.nextPageToken;
        
        if (data.items && data.items.length > 0) {
            featuredVideoId = data.items[0].id.videoId;
            
            player = new YT.Player('featured-video-player', {
                height: '540',
                width: '960',
                videoId: featuredVideoId,
                playerVars: {
                    'playsinline': 1,
                    'modestbranding': 1,
                    'rel': 0,
                    'autoplay': 1,
                    'controls': 0,
                    'disablekb': 1,
                    'fs': 0,
                    'iv_load_policy': 3,
                    'loop': 1,
                    'playlist': featuredVideoId,
                    'showinfo': 0,
                    'mute': 0, // Start unmuted
                    'enablejsapi': 1
                },
                events: {
                    'onReady': function(event) {
                        event.target.playVideo();
                    },
                    'onStateChange': function(event) {
                        if (event.data === YT.PlayerState.ENDED) {
                            player.playVideo();
                        }
                    }
                }
            });

            const videoGrid = document.getElementById('video-grid');
            videoGrid.innerHTML = '';
            
            createVideoCards(data.items.slice(1), videoGrid);

            if (nextPageToken) {
                const loadMoreContainer = document.createElement('div');
                loadMoreContainer.className = 'load-more-container';
                loadMoreContainer.innerHTML = `
                    <button id="load-more" class="load-more-button">Load More Videos</button>
                `;
                videoGrid.parentNode.insertBefore(loadMoreContainer, videoGrid.nextSibling);
                document.getElementById('load-more').addEventListener('click', loadMoreVideos);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('video-grid').innerHTML = '<p>Error loading videos. Please try again later.</p>';
    }
}

function onYouTubeIframeAPIReady() {
    initializePage();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.YT) {
        initializePage();
    }

    const muteButton = document.getElementById('mute-button');
    muteButton.addEventListener('click', () => {
        if (player) {
            if (isMuted) {
                player.unMute();
                muteButton.textContent = 'Mute';
            } else {
                player.mute();
                muteButton.textContent = 'Unmute';
            }
            isMuted = !isMuted;
        }
    });
});