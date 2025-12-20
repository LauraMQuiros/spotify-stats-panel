// server/csvUtils.ts
// Shared CSV utility functions

import fs from 'fs';

// Parse CSV line (handles quoted fields)
export const parseCSVLine = (line: string): string[] => {
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
export const escapeCSV = (field: string): string => {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

// Core logic to add tracks to CSV file
// Returns the number of tracks added
export const addTracksToCSVFile = (
  csvFilePath: string,
  tracks: any[],
  existingContent: string
): number => {
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
    // Support both formats: direct track object or { track, played_at } format
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
      existingKeys.add(key); // Prevent duplicates within the same batch
    }
  });
  
  // Append new lines to CSV
  if (newLines.length > 0) {
    const newContent = existingContent.trimEnd() + '\n' + newLines.join('\n') + '\n';
    fs.writeFileSync(csvFilePath, newContent, 'utf8');
  }
  
  return addedCount;
};

