// IMPORTANT:  Do NOT put your actual API key here in the code you save!
// We'll use an environment variable in Cloudflare.
const apiKey = 'YOUR_YOUTUBE_API_KEY'; //This is the line we will change in Cloudflare.
const channelId = 'UUCgR5VYHYy-u_HIiimcYQOMA'; // Your channel ID (Corrected)
const videoGrid = document.querySelector('.video-grid');

async function getYouTubeVideos() {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=10`); // Fetch latest 10
        const data = await response.json();

        if (data.items) {
            data.items.forEach(item => {
                if (item.id.kind === 'youtube#video') {
                    const videoId = item.id.videoId;
                    const title = item.snippet.title;
                    const thumbnailUrl = item.snippet.thumbnails.high.url; // Use high-res thumbnail
                    const description = item.snippet.description;

                    const videoItem = document.createElement('div');
                    videoItem.classList.add('video-item');
                    videoItem.innerHTML = `
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">
                            <img src="${thumbnailUrl}" alt="${title}">
                        </a>
                        <h3>${title}</h3>
                        <p>${description.substring(0,100)}...</p>
                    `;
                    videoGrid.appendChild(videoItem);
                }
            });
        } else {
            console.error('No videos found.');
            videoGrid.innerHTML = '<p>No videos found.</p>';
        }
    } catch (error) {
        console.error('Error fetching videos:', error);
        videoGrid.innerHTML = '<p>Error fetching videos. Please try again later.</p>';
    }
}

getYouTubeVideos();