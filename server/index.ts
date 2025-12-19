// server/index.ts
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import csvStorageRouter from './csvStorage';
import { startCSVUpdateService } from './spotifyService';

const app = express();
app.use(cors({ origin: 'http://127.0.0.1:8080' }));
// Increase body size limit to handle large track lists (default is 100kb, we need more for paginated results)
app.use(express.json({ limit: '10mb' }));

app.use('/csv', csvStorageRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  
  // Start the background CSV update service (runs every 3 minutes)
  const UPDATE_INTERVAL_MINUTES = 3;
  startCSVUpdateService(UPDATE_INTERVAL_MINUTES);
  console.log(`✓ Background CSV update service started (interval: ${UPDATE_INTERVAL_MINUTES} minutes)`);
});