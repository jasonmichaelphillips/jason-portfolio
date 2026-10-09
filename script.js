const PLAYLIST_ID = 'PL0i4Tca5g7T_S5tipX5smaX_b0BjnP_gz';
const WORKER_URL = '';
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
        image.loading = 'lazy';
        const info = document.createElement('div');
        info.className = 'video-info';
        const heading = document.createElement('h3');
        heading.textContent = title;
        info.appendChild(heading);
        videoCard.append(image, info);
        container.appendChild(videoCard);
    });
}

async function loadVideosInfinite() {
    if (isLoading || (!nextPageToken && !firstLoad)) return;
    isLoading = true;
    try {
        const url = nextPageToken
            ? `${WORKER_URL}/api/videos?pageToken=${nextPageToken}`
            : `${WORKER_URL}/api/videos`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        nextPageToken = data.nextPageToken;

        const videoGrid = document.getElementById('video-grid');
        let items = data.items || [];

        // On first load, set featured video and skip it in the grid
        if (firstLoad && items.length > 0) {
            featuredVideoId = items[0].id || items[0].snippet?.resourceId?.videoId;
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
    muteButton?.addEventListener('click', () => {
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
