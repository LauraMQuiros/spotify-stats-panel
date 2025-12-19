// server/spotifyService.ts
// Background service to periodically fetch recently played tracks and update CSV

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const CSV_FILE_PATH = path.join(process.cwd(), 'data', 'spotify_history.csv');

// Store token in memory (could be enhanced to use a database or file)
let storedToken: string | null = null;

// Set the token (called by frontend)
export const setToken = (token: string) => {
  storedToken = token;
  console.log('✓ Spotify token stored for background CSV updates');
};

// Clear the token
export const clearToken = () => {
  storedToken = null;
  console.log('✓ Spotify token cleared');
};

// Check if token is available
export const hasToken = (): boolean => {
  return storedToken !== null;
};

// Fetch recently played tracks from Spotify API (with pagination)
const fetchRecentlyPlayed = async (token: string): Promise<any[]> => {
  const allItems: any[] = [];
  let before: number | null = null;
  let hasMore = true;
  const maxLimit = 50; // Spotify API maximum

  while (hasMore) {
    let url = `https://api.spotify.com/v1/me/player/recently-played?limit=${maxLimit}`;
    if (before) {
      url += `&before=${before}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token expired or invalid');
      }
      throw new Error(`Failed to fetch recently played tracks: ${response.status}`);
    }

    const data = await response.json();
    const items = data?.items ?? [];
    
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    allItems.push(...items);

    if (items.length > 0) {
      const oldestItem = items[items.length - 1];
      const oldestTimestamp = new Date(oldestItem.played_at).getTime();
      
      if (items.length === maxLimit || (data.cursors?.before && oldestTimestamp !== before)) {
        before = oldestTimestamp;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allItems;
};

// Parse CSV line (handles quoted fields)
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

// Escape CSV field
const escapeCSV = (field: string): string => {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

// Update CSV with new tracks
const updateCSV = async (tracks: any[]): Promise<number> => {
  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error('CSV file does not exist');
  }

  // Read existing CSV
  const existingContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  const existingLines = existingContent.split('\n').filter(line => line.trim());
  
  // Create set of existing track IDs + exact timestamps
  const existingKeys = new Set(
    existingLines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      if (fields.length >= 8) {
        return `${fields[1]}-${fields[7]}`;
      }
      return null;
    }).filter((key): key is string => key !== null)
  );
  
  // Create new CSV lines for tracks
  const newLines: string[] = [];
  let addedCount = 0;
  
  tracks.forEach((item: any) => {
    const track = item.track || item;
    const playedAt = item.played_at || new Date().toISOString();
    const date = new Date(playedAt).toISOString().split('T')[0];
    
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
      existingKeys.add(key);
    }
  });
  
  // Append new lines to CSV
  if (newLines.length > 0) {
    const newContent = existingContent.trimEnd() + '\n' + newLines.join('\n') + '\n';
    fs.writeFileSync(CSV_FILE_PATH, newContent, 'utf8');
  }
  
  return addedCount;
};

// Fetch and update CSV
const fetchAndUpdateCSV = async (): Promise<void> => {
  if (!storedToken) {
    console.log('⏸ Skipping CSV update: No token available');
    return;
  }

  try {
    console.log('🔄 Fetching recently played tracks for CSV update...');
    const tracks = await fetchRecentlyPlayed(storedToken);
    console.log(`📊 Fetched ${tracks.length} recently played tracks`);
    
    if (tracks.length > 0) {
      const addedCount = await updateCSV(tracks);
      if (addedCount > 0) {
        console.log(`✅ CSV updated: Added ${addedCount} new tracks`);
      } else {
        console.log(`ℹ CSV update: No new tracks to add (all ${tracks.length} already exist)`);
      }
    } else {
      console.log('ℹ No tracks found in recently played history');
    }
  } catch (error: any) {
    if (error.message?.includes('Token expired')) {
      console.error('❌ Token expired - clearing stored token');
      clearToken();
    } else {
      console.error('❌ Error updating CSV:', error.message || error);
    }
  }
};

// Start the periodic CSV update service
let updateInterval: NodeJS.Timeout | null = null;

export const startCSVUpdateService = (intervalMinutes: number = 3) => {
  if (updateInterval) {
    console.log('⚠ CSV update service already running');
    return;
  }

  console.log(`🚀 Starting CSV auto-update service (every ${intervalMinutes} minutes)`);
  
  // Fetch immediately on startup
  fetchAndUpdateCSV();
  
  // Then fetch periodically
  updateInterval = setInterval(() => {
    fetchAndUpdateCSV();
  }, intervalMinutes * 60 * 1000);
};

export const stopCSVUpdateService = () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('⏹ Stopped CSV update service');
  }
};

