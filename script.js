const CHANNEL_ID = 'UCgR5VYHYy-u_HIiimcYQOMA';
const WORKER_URL = 'https://youtubeworker.wickedshrapnel.workers.dev';

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
        document.getElementById('featured').scrollIntoView({ behavior: 'smooth' });
    }
}

async function initializePage() {
    try {
        const response = await fetch(`${WORKER_URL}/api/videos`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
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
                    'mute': 1, // Required for autoplay to work
                    'enablejsapi': 1
                },
                events: {
                    'onReady': function(event) {
                        event.target.playVideo();
                    },
                    'onStateChange': function(event) {
                        if (event.data === YT.PlayerState.ENDED) {
                            player.playVideo(); // Restart when ended
                        }
                    }
                }
            });

            // Rest of your video grid code...
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('video-grid').innerHTML = '<p>Error loading videos. Please try again later.</p>';
    }
}

function onYouTubeIframeAPIReady() {
    initializePage();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.YT) {
        initializePage();
    }
});