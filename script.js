const PLAYLIST_ID = 'PL0i4Tca5g7T_S5tipX5smaX_b0BjnP_gz';
const WORKER_URL = 'https://youtubeworker.wickedshrapnel.workers.dev';
let nextPageToken = '';
let isMuted = false;
let player;
let featuredVideoId;
let isLoading = false;
let firstLoad = true;

// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

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
            loadVideoInPlayer(item.snippet.resourceId.videoId);
        });
        container.appendChild(videoCard);
    });
}

async function loadVideosInfinite() {
    if (isLoading || (!nextPageToken && !firstLoad)) return;
    isLoading = true;
    try {
        const url = nextPageToken
            ? `${WORKER_URL}/api/playlistItems?playlistId=${PLAYLIST_ID}&pageToken=${nextPageToken}`
            : `${WORKER_URL}/api/playlistItems?playlistId=${PLAYLIST_ID}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        nextPageToken = data.nextPageToken;

        const videoGrid = document.getElementById('video-grid');
        let items = data.items || [];

        // On first load, set featured video and skip it in the grid
        if (firstLoad && items.length > 0) {
            featuredVideoId = items[0].snippet.resourceId.videoId;
            player = new YT.Player('featured-video-player', {
                width: '100%',
                height: '100%',
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
                    'mute': 0,
                    'enablejsapi': 1
                },
                events: {
                    'onReady': function(event) {
                        if (!isMuted) event.target.unMute();
                        event.target.playVideo();
                    },
                    'onStateChange': function(event) {
                        if (event.data === YT.PlayerState.ENDED) {
                            player.playVideo();
                        }
                    }
                }
            });
            items = items.slice(1); // Remove featured from grid
            firstLoad = false;
        }
        createVideoCards(items, videoGrid);
    } catch (error) {
        console.error('Error loading videos:', error);
        if (firstLoad) {
            document.getElementById('video-grid').innerHTML = '<p>Error loading videos. Please try again later.</p>';
        }
    }
    isLoading = false;
}

function onYouTubeIframeAPIReady() {
    loadVideosInfinite();
}

document.addEventListener('DOMContentLoaded', () => {
    // Infinite scroll
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 400)) {
            loadVideosInfinite();
        }
    });

    // Mute/unmute button
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

    // If YouTube API is already loaded
    if (window.YT && window.YT.Player) {
        onYouTubeIframeAPIReady();
    }
});