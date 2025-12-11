// server/index.ts
import dotenv from 'dotenv';
dotenv.config(); // loads SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI
import express from 'express';
import cors from 'cors';
import spotifyAuthRouter from './spotifyAuth';

const app = express();
app.use(cors({ origin: 'http://127.0.0.1:8080' })); // adjust frontend origin
app.use(express.json());

app.use('/auth', spotifyAuthRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`);
});