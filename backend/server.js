import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { buildFinancePayload } from './finance-data.js';

const app = express();
app.use(cors());

const API_KEY = process.env.YOUTUBE_API_KEY;
const PORT = process.env.PORT || 3000;

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

app.get('/api/finance', async (req, res) => {
  try {
    const payload = await buildFinancePayload();
    res.json(payload);
  } catch (error) {
    console.error('Error fetching finance data:', error);
    res.status(500).json({ error: 'Error fetching finance data', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
