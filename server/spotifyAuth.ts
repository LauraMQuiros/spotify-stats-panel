// server/spotifyAuth.ts
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.post('/token', async (req, res) => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: req.body.code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
  });

  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await r.json();
  res.json(data);
});

export default router;
