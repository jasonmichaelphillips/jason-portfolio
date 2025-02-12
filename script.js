const API_KEY = 'AIzaSyA0WI_xOUGvPbGql9NEPZX4wjKyAqBF_Og'; // TODO: Move to secure backend
const CHANNEL_ID = 'UCgR5VYHYy-u_HIiimcYQOMA';

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
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=12&type=video`
        );
        
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
                    'autoplay': 0
                }
            });

            const videoGrid = document.getElementById('video-grid');
            videoGrid.innerHTML = ''; // Clear existing content
            
            data.items.slice(1).forEach(item => {
                const videoCard = document.createElement('div');
                videoCard.className = 'video-card';
                videoCard.innerHTML = `
                    <img src="${item.snippet.thumbnails.high.url}" alt="${item.snippet.title}">
                    <div class="video-info">
                        <h3>${item.snippet.title}</h3>
                    </div>
                `;
                videoCard.addEventListener('click', () => {
                    loadVideoInPlayer(item.id.videoId);
                });
                videoGrid.appendChild(videoCard);
            });
        }
    } catch (error) {
        console.error('Error fetching videos:', error);
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
});