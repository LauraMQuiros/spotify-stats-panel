// server/csvStorage.ts
import express from 'express';
import fs from 'fs';
import path from 'path';
import { setToken, clearToken, saveRefreshTokenToEnv } from './spotifyService';
import { parseCSVLine, addTracksToCSVFile } from './csvUtils';

const router = express.Router();
const CSV_FILE_PATH = path.join(process.cwd(), 'data', 'spotify_history.csv');
const HEADERS = 'date,trackId,trackName,artistName,albumName,durationMs,popularity,timestamp\n';

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Ensure CSV file exists with headers
const ensureCSVFile = () => {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(CSV_FILE_PATH)) {
      fs.writeFileSync(CSV_FILE_PATH, HEADERS, 'utf8');
      console.log(`✓ Created CSV file at ${CSV_FILE_PATH}`);
    }
  } catch (error) {
    console.error(`✗ Error ensuring CSV file exists:`, error);
    throw error;
  }
};

// Initialize CSV file when module loads (server startup)
try {
  ensureCSVFile();
  console.log(`✓ CSV storage initialized - file ready at ${CSV_FILE_PATH}`);
} catch (error) {
  console.error(`✗ Failed to initialize CSV storage:`, error);
}


// GET /csv - Health check endpoint
router.get('/', (req, res) => {
  try {
    ensureCSVFile();
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const recordCount = Math.max(0, lines.length - 1); // Subtract header
    
    // Check if refresh token exists in .env
    const envPath = path.join(process.cwd(), '.env');
    let hasRefreshToken = false;
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      hasRefreshToken = envContent.includes('SPOTIFY_REFRESH_TOKEN=');
    }
    
    res.json({ 
      success: true, 
      message: 'CSV storage is working',
      filePath: CSV_FILE_PATH,
      recordCount,
      hasRefreshToken,
      endpoints: {
        'GET /csv': 'This endpoint (health check)',
        'GET /csv/records': 'Get all CSV records',
        'POST /csv/add': 'Add tracks to CSV (requires JSON body)',
        'GET /csv/download': 'Download CSV file',
        'DELETE /csv/clear': 'Clear all records',
        'POST /csv/token': 'Set Spotify token for background updates',
        'DELETE /csv/token': 'Clear Spotify token',
        'POST /csv/refresh-token': 'Save refresh token to .env',
        'GET /csv/total-listening-time': 'Get total listening time from CSV',
      },
      ...(hasRefreshToken ? {} : {
        warning: 'No refresh token found in .env. Log in through the frontend to get one automatically, or add SPOTIFY_REFRESH_TOKEN to .env manually.'
      })
    });
  } catch (error) {
    console.error('Error in CSV health check:', error);
    res.status(500).json({ success: false, error: 'CSV storage error' });
  }
});

// GET /csv/records - Get all records
router.get('/records', (req, res) => {
  try {
    ensureCSVFile();
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    res.json({ success: true, data: csvContent });
  } catch (error) {
    console.error('Error reading CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to read CSV file' });
  }
});

// POST /csv/add - Add new tracks (recently played with timestamps)
router.post('/add', (req, res) => {
  try {
    ensureCSVFile();
    const { tracks } = req.body;
    
    console.log(`Received request to add ${tracks?.length || 0} tracks to CSV`);
    
    if (!tracks || !Array.isArray(tracks)) {
      console.error('Invalid tracks data:', { tracks, type: typeof tracks, isArray: Array.isArray(tracks) });
      return res.status(400).json({ success: false, error: 'Invalid tracks data' });
    }

    // Read existing CSV
    const existingContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    
    // Use shared function to add tracks
    const addedCount = addTracksToCSVFile(CSV_FILE_PATH, tracks, existingContent);
    
    if (addedCount > 0) {
      console.log(`✓ Successfully added ${addedCount} new tracks to CSV`);
    } else {
      console.log(`ℹ No new tracks to add (all ${tracks.length} tracks already exist)`);
    }
    
    res.json({ 
      success: true, 
      message: `Added ${addedCount} new tracks`,
      addedCount 
    });
  } catch (error) {
    console.error('✗ Error adding tracks to CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to add tracks to CSV' });
  }
});

// DELETE /csv/clear - Clear all records
router.delete('/clear', (req, res) => {
  try {
    ensureDataDirectory();
    fs.writeFileSync(CSV_FILE_PATH, HEADERS, 'utf8');
    res.json({ success: true, message: 'CSV cleared successfully' });
  } catch (error) {
    console.error('Error clearing CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to clear CSV' });
  }
});

// GET /csv/download - Download CSV file
router.get('/download', (req, res) => {
  try {
    ensureCSVFile();
    const date = new Date().toISOString().split('T')[0];
    res.download(CSV_FILE_PATH, `spotify_history_${date}.csv`);
  } catch (error) {
    console.error('Error downloading CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to download CSV' });
  }
});

// POST /csv/upload - Upload/replace CSV file
router.post('/upload', express.text({ type: 'text/csv', limit: '10mb' }), (req, res) => {
  try {
    ensureDataDirectory();
    const csvContent = req.body;
    
    // Basic validation
    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid CSV content' });
    }
    
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0 || !lines[0].includes('trackId')) {
      return res.status(400).json({ success: false, error: 'Invalid CSV format' });
    }
    
    fs.writeFileSync(CSV_FILE_PATH, csvContent, 'utf8');
    res.json({ success: true, message: 'CSV uploaded successfully' });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    res.status(500).json({ success: false, error: 'Failed to upload CSV' });
  }
});

// POST /csv/token - Set Spotify token for background CSV updates
router.post('/token', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid token' });
    }
    
    setToken(token);
    res.json({ success: true, message: 'Token set for background CSV updates' });
  } catch (error) {
    console.error('Error setting token:', error);
    res.status(500).json({ success: false, error: 'Failed to set token' });
  }
});

// DELETE /csv/token - Clear Spotify token
router.delete('/token', (req, res) => {
  try {
    clearToken();
    res.json({ success: true, message: 'Token cleared' });
  } catch (error) {
    console.error('Error clearing token:', error);
    res.status(500).json({ success: false, error: 'Failed to clear token' });
  }
});

// POST /csv/refresh-token - Save refresh token to .env file
router.post('/refresh-token', (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    console.log('Received refresh token request:', { hasToken: !!refreshToken, tokenLength: refreshToken?.length });
    
    if (!refreshToken || typeof refreshToken !== 'string') {
      console.error('Invalid refresh token:', { refreshToken, type: typeof refreshToken });
      return res.status(400).json({ success: false, error: 'Invalid refresh token' });
    }
    
    saveRefreshTokenToEnv(refreshToken);
    console.log('✓ Refresh token saved to .env file successfully');
    res.json({ success: true, message: 'Refresh token saved to .env file' });
  } catch (error) {
    console.error('✗ Error saving refresh token:', error);
    res.status(500).json({ success: false, error: 'Failed to save refresh token' });
  }
});

// GET /csv/total-listening-time - Calculate total listening time from CSV
router.get('/total-listening-time', (req, res) => {
  try {
    ensureCSVFile();
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    let totalMs = 0;
    
    for (const line of dataLines) {
      const fields = parseCSVLine(line);
      if (fields.length >= 6) {
        const durationMs = parseInt(fields[5], 10);
        if (!isNaN(durationMs)) {
          totalMs += durationMs;
        }
      }
    }
    
    res.json({ 
      success: true, 
      totalMs,
      totalMinutes: Math.floor(totalMs / 60000),
      totalHours: Math.floor(totalMs / 3600000),
      totalDays: Math.floor(totalMs / 86400000)
    });
  } catch (error) {
    console.error('Error calculating total listening time:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate total listening time' });
  }
});

export default router;