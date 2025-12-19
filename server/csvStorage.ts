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

// Escape CSV field
const escapeCSV = (field: string): string => {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

// Helper to parse CSV line (handles quoted fields)
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
};

// GET /csv - Health check endpoint
router.get('/', (req, res) => {
  try {
    ensureCSVFile();
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const recordCount = Math.max(0, lines.length - 1); // Subtract header
    
    res.json({ 
      success: true, 
      message: 'CSV storage is working',
      filePath: CSV_FILE_PATH,
      recordCount,
      endpoints: {
        'GET /csv': 'This endpoint (health check)',
        'GET /csv/records': 'Get all CSV records',
        'POST /csv/add': 'Add tracks to CSV (requires JSON body)',
        'GET /csv/download': 'Download CSV file',
        'DELETE /csv/clear': 'Clear all records'
      }
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
    const existingLines = existingContent.split('\n').filter(line => line.trim());
    
    // Create set of existing track IDs + exact timestamps (only to prevent exact duplicate API responses)
    // This allows the same song to appear multiple times if played at different times
    const existingKeys = new Set(
      existingLines.slice(1).map(line => {
        const fields = parseCSVLine(line);
        if (fields.length >= 8) {
          // Use trackId + exact timestamp as unique key (only prevents exact duplicates from API)
          return `${fields[1]}-${fields[7]}`;
        }
        return null;
      }).filter((key): key is string => key !== null)
    );
    
    // Create new CSV lines for tracks - log every play
    const newLines: string[] = [];
    let addedCount = 0;
    
    tracks.forEach((item: any) => {
      // Support both formats: direct track object or { track, played_at } format
      const track = item.track || item;
      const playedAt = item.played_at || new Date().toISOString();
      
      // Extract date from played_at timestamp
      const date = new Date(playedAt).toISOString().split('T')[0];
      
      // Only deduplicate on exact trackId + exact timestamp match
      // This means: same song at different times = logged multiple times ✓
      //            same song at same exact time (duplicate API response) = deduplicated ✓
      const key = `${track.id}-${playedAt}`;
      if (!existingKeys.has(key)) {
        const line = [
          date,
          track.id,
          escapeCSV(track.name),
          escapeCSV(track.artists.map((a: any) => a.name).join('; ')),
          escapeCSV(track.album.name),
          track.duration_ms.toString(),
          track.popularity.toString(),
          playedAt
        ].join(',');
        
        newLines.push(line);
        addedCount++;
        existingKeys.add(key); // Prevent duplicates within the same batch
      }
    });
    
    // Append new lines to CSV
    if (newLines.length > 0) {
      const newContent = existingContent.trimEnd() + '\n' + newLines.join('\n') + '\n';
      fs.writeFileSync(CSV_FILE_PATH, newContent, 'utf8');
      console.log(`✓ Successfully added ${addedCount} new tracks to CSV (${newLines.length} total lines)`);
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

export default router;