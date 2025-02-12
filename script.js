// Function to load the IFrame Player API.
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
function onYouTubeIframeAPIReady() {
  player = new YT.Player('featured-video-player', { // Replace with your div ID
    height: '390',
    width: '640',
    videoId: 'MXRRuZ8u9ts&t=51s', // Replace with a video ID
    events: {
      'onReady': onPlayerReady
    }
  });
}

function onPlayerReady(event) {
  // You can control the player here (e.g., autoplay).
  // event.target.playVideo();
}

const API_KEY = 'YOUTUBE_API_KEY_JMP'; // Get your API key from Google Cloud Console
const CHANNEL_ID = 'UCgR5VYHYy-u_HIiimcYQOMA';

async function fetchVideos() {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&type=video&key=${API_KEY}&maxResults=10`; // Adjust maxResults
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    // Process the video data and create HTML elements for each video
    const videoGrid = document.getElementById('video-grid');
    data.items.forEach(item => {
      const videoId = item.id.videoId;
      const title = item.snippet.title;
      const thumbnail = item.snippet.thumbnails.medium.url; // Choose thumbnail size

      const videoDiv = document.createElement('div');
      videoDiv.innerHTML = `
        <img src="${thumbnail}" alt="${title}">
        <h3>${title}</h3>
        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">Watch</a>
      `;
      videoGrid.appendChild(videoDiv);
    });
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

fetchVideos(); // Call the function to fetch videos