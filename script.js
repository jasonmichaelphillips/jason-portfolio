let player;
let youtubeApiPromise;

function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise((resolve, reject) => {
        const previousCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previousCallback?.();
            resolve();
        };

        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => reject(new Error('Unable to load the YouTube player.'));
        document.head.appendChild(script);
    });

    return youtubeApiPromise;
}

async function playFeaturedVideo(button) {
    const videoId = button.dataset.videoId;
    if (!videoId) return;

    try {
        await loadYouTubeApi();
        const playerHost = document.createElement('div');
        playerHost.id = 'featured-video-player';
        button.replaceWith(playerHost);
        player = new YT.Player(playerHost, {
            width: '100%',
            height: '100%',
            videoId,
            playerVars: {
                playsinline: 1,
                modestbranding: 1,
                rel: 0,
                controls: 1,
                fs: 1,
                iv_load_policy: 3,
                enablejsapi: 1,
            },
        });
    } catch (error) {
        console.error('Unable to start the featured video:', error);
    }
}

document.addEventListener('click', (event) => {
    const poster = event.target.closest('.featured-poster');
    if (!poster) return;
    event.preventDefault();
    playFeaturedVideo(poster);
});
