// src/lib/csvDatabase.ts
import { SpotifyTrack, SpotifyPlayHistoryEntry } from './spotify';

const API_BASE = 'http://localhost:3000/csv';


// Add tracks to CSV (sends to server)
// Accepts either SpotifyPlayHistoryEntry[] (with played_at) or SpotifyTrack[]
// Batches large requests to avoid payload size limits
export const addTracksToCSV = async (tracks: SpotifyPlayHistoryEntry[] | SpotifyTrack[]): Promise<void> => {
  if (!tracks || tracks.length === 0) {
    console.warn('No tracks to add to CSV');
    return;
  }

  try {
    // Check if first item has played_at (PlayHistoryEntry format)
    const isPlayHistory = tracks.length > 0 && 'played_at' in tracks[0];
    
    // Batch tracks in chunks of 100 to avoid payload size limits
    const BATCH_SIZE = 100;
    const batches: (SpotifyPlayHistoryEntry[] | SpotifyTrack[])[] = [];
    
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      batches.push(tracks.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Attempting to add ${tracks.length} tracks to CSV in ${batches.length} batch(es) via ${API_BASE}/add`);
    
    // Process batches sequentially to avoid overwhelming the server
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const payload = { tracks: isPlayHistory ? batch : batch.map(track => ({ track, played_at: new Date().toISOString() })) };
      
      const response = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        console.log(`✓ CSV updated batch ${i + 1}/${batches.length}: ${data.message}`);
      } else {
        console.error(`✗ Failed to add batch ${i + 1}/${batches.length} to CSV:`, data.error);
      }
    }
    
    console.log(`✓ Successfully processed all ${batches.length} batch(es) of tracks`);
  } catch (error) {
    console.error('✗ Error adding tracks to CSV:', error);
    console.error('Make sure the backend server is running on http://localhost:3000');
    // Don't throw - we don't want to break the app if CSV storage fails
  }
};



// Get total listening time from CSV
export const getTotalListeningTime = async (): Promise<number> => {
  try {
    const response = await fetch(`${API_BASE}/total-listening-time`);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      // Read response as text first (body stream can only be read once)
      const errorText = await response.text();
      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // If not JSON, use the text as-is
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return data.totalMs;
    }
    return 0;
  } catch (error) {
    console.error('Error fetching total listening time:', error);
    return 0;
  }
};