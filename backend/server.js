require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const API_KEY = process.env.YOUTUBE_API_KEY;
const PORT = 3000;

app.get('/api/videos', async (req, res) => {
    try {
        const channelId = 'UCgR5VYHYy-u_HIiimcYQOMA';
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=12&type=video`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching videos' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});