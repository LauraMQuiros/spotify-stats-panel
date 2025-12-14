// src/lib/csvDatabase.ts
import { SpotifyTrack } from './spotify';

const API_BASE = 'http://localhost:3000/csv';

export interface PlayRecord {
  date: string;
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  durationMs: number;
  popularity: number;
  timestamp: string;
}

// Parse CSV line
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

// Convert CSV line to record
const csvLineToRecord = (line: string): PlayRecord | null => {
  try {
    const fields = parseCSVLine(line);
    if (fields.length < 8) return null;
    
    return {
      date: fields[0],
      trackId: fields[1],
      trackName: fields[2],
      artistName: fields[3],
      albumName: fields[4],
      durationMs: parseInt(fields[5]),
      popularity: parseInt(fields[6]),
      timestamp: fields[7]
    };
  } catch (error) {
    console.error('Error parsing CSV line:', error);
    return null;
  }
};

// Get current date
const getCurrentDate = (): string => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Add tracks to CSV (sends to server)
export const addTracksToCSV = async (tracks: SpotifyTrack[]): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tracks }),
    });
    
    const data = await response.json();
    if (data.success) {
      console.log(data.message);
    } else {
      console.error('Failed to add tracks:', data.error);
    }
  } catch (error) {
    console.error('Error adding tracks to CSV:', error);
  }
};

// Get all records from server
export const getAllRecords = async (): Promise<PlayRecord[]> => {
  try {
    const response = await fetch(`${API_BASE}/records`);
    const data = await response.json();
    
    if (data.success) {
      const lines = data.data.split('\n').slice(1); // Skip header
      return lines
        .map(csvLineToRecord)
        .filter((r): r is PlayRecord => r !== null);
    }
    return [];
  } catch (error) {
    console.error('Error fetching records:', error);
    return [];
  }
};

// Get records for a specific date
export const getRecordsByDate = async (date: string): Promise<PlayRecord[]> => {
  const allRecords = await getAllRecords();
  return allRecords.filter(r => r.date === date);
};

// Get today's records
export const getTodaysRecords = async (): Promise<PlayRecord[]> => {
  return getRecordsByDate(getCurrentDate());
};

// Get records for date range
export const getRecordsByDateRange = async (startDate: string, endDate: string): Promise<PlayRecord[]> => {
  const allRecords = await getAllRecords();
  return allRecords.filter(r => r.date >= startDate && r.date <= endDate);
};

// Export CSV (download from server)
export const exportCSV = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/download`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spotify_history_${getCurrentDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting CSV:', error);
  }
};

// Import CSV (upload to server)
export const importCSV = async (csvContent: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv',
      },
      body: csvContent,
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to upload CSV');
    }
  } catch (error) {
    console.error('Error importing CSV:', error);
    throw error;
  }
};

// Clear all records
export const clearAllRecords = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/clear`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('CSV cleared successfully');
    }
  } catch (error) {
    console.error('Error clearing CSV:', error);
  }
};

// Get statistics
export const getStatistics = async () => {
  const records = await getAllRecords();
  const uniqueTracks = new Set(records.map(r => r.trackId)).size;
  const uniqueDates = new Set(records.map(r => r.date)).size;
  const totalRecords = records.length;
  
  return {
    totalRecords,
    uniqueTracks,
    uniqueDates,
    averageTracksPerDay: uniqueDates > 0 ? (totalRecords / uniqueDates).toFixed(2) : '0'
  };
};