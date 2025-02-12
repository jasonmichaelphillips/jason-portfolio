const apiKey = 'YOUTUBE_API_KEY_JMP';
const channelId = 'UCgR5VYHYy-u_HIiimcYQOMA';

fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${channelId}&key=${apiKey}`)
  .then(response => response.json())
  .then(data => {
    // Handle the data here
    console.log(data.items); // This will log the playlists
  });