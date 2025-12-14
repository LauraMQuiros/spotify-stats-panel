// server/csvStorage.ts
import express from 'express';
import fs from 'fs';
import path from 'path';

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
  ensureDataDirectory();
  if (!fs.existsSync(CSV_FILE_PATH)) {
    fs.writeFileSync(CSV_FILE_PATH, HEADERS, 'utf8');
  }
};

// Escape CSV field
const escapeCSV = (field: string): string => {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

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

// POST /csv/add - Add new tracks
router.post('/add', (req, res) => {
  try {
    ensureCSVFile();
    const { tracks } = req.body;
    
    if (!tracks || !Array.isArray(tracks)) {
      return res.status(400).json({ success: false, error: 'Invalid tracks data' });
    }

    // Read existing CSV
    const existingContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const existingLines = existingContent.split('\n').filter(line => line.trim());
    
    // Get current date and timestamp
    const date = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    
    // Create set of existing track IDs for today (to avoid duplicates)
    const existingKeys = new Set(
      existingLines.slice(1).map(line => {
        const fields = line.split(',');
        return `${fields[0]}-${fields[1]}`;
      })
    );
    
    // Create new CSV lines for tracks
    const newLines: string[] = [];
    let addedCount = 0;
    
    tracks.forEach((track: any) => {
      const key = `${date}-${track.id}`;
      if (!existingKeys.has(key)) {
        const line = [
          date,
          track.id,
          escapeCSV(track.name),
          escapeCSV(track.artists.map((a: any) => a.name).join('; ')),
          escapeCSV(track.album.name),
          track.duration_ms.toString(),
          track.popularity.toString(),
          timestamp
        ].join(',');
        
        newLines.push(line);
        addedCount++;
      }
    });
    
    // Append new lines to CSV
    if (newLines.length > 0) {
      const newContent = existingContent.trimEnd() + '\n' + newLines.join('\n') + '\n';
      fs.writeFileSync(CSV_FILE_PATH, newContent, 'utf8');
    }
    
    res.json({ 
      success: true, 
      message: `Added ${addedCount} new tracks`,
      addedCount 
    });
  } catch (error) {
    console.error('Error adding tracks to CSV:', error);
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

export default router;