// server/index.ts
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import spotifyAuthRouter from './spotifyAuth';
import csvStorageRouter from './csvStorage';  // ← ADD THIS

const app = express();
app.use(cors({ origin: 'http://127.0.0.1:8080' }));
app.use(express.json());

app.use('/auth', spotifyAuthRouter);
app.use('/csv', csvStorageRouter);  // ← ADD THIS

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`);
});