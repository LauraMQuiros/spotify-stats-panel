// server/db.ts
// Neon Postgres database utilities (via Vercel Marketplace)

import { neon } from '@neondatabase/serverless';

// Create SQL client using connection string from environment
const sql = neon(process.env.DATABASE_URL || '');

// Initialize database schema (create table if it doesn't exist)
export const initDatabase = async (): Promise<void> => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS spotify_history (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        track_id VARCHAR(255) NOT NULL,
        track_name TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        album_name TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        popularity INTEGER,
        timestamp TIMESTAMPTZ NOT NULL,
        UNIQUE(track_id, timestamp)
      )
    `;
    
    // Create index on date for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_spotify_history_date ON spotify_history(date)
    `;
    
    // Create index on track_id for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_spotify_history_track_id ON spotify_history(track_id)
    `;
    
    // Create index on timestamp for faster sorting
    await sql`
      CREATE INDEX IF NOT EXISTS idx_spotify_history_timestamp ON spotify_history(timestamp DESC)
    `;
    
    console.log('✓ Database schema initialized');
  } catch (error) {
    console.error('✗ Error initializing database:', error);
    throw error;
  }
};

// Add tracks to database (with deduplication)
export const addTracksToDatabase = async (tracks: any[]): Promise<number> => {
  if (!tracks || tracks.length === 0) {
    return 0;
  }

  let addedCount = 0;
  const beforeCount = await getTrackCount();

  for (const item of tracks) {
    const track = item.track || item;
    const playedAt = item.played_at || new Date().toISOString();
    const date = new Date(playedAt).toISOString().split('T')[0];

    try {
      // Use INSERT ... ON CONFLICT to handle deduplication
      await sql`
        INSERT INTO spotify_history (
          date, track_id, track_name, artist_name, album_name, duration_ms, popularity, timestamp
        ) VALUES (
          ${date},
          ${track.id},
          ${track.name},
          ${track.artists.map((a: any) => a.name).join('; ')},
          ${track.album.name},
          ${track.duration_ms},
          ${track.popularity},
          ${playedAt}
        )
        ON CONFLICT (track_id, timestamp) DO NOTHING
      `;
    } catch (error: any) {
      // If it's a duplicate or unique constraint violation, that's fine - skip it
      if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
        console.error(`Error adding track ${track.id}:`, error.message);
      }
    }
  }

  // Count how many were actually added
  const afterCount = await getTrackCount();
  addedCount = afterCount - beforeCount;

  return addedCount;
};

// Get all tracks from database (for CSV export or API)
export const getAllTracks = async (): Promise<any[]> => {
  try {
    const result = await sql`
      SELECT 
        date,
        track_id as "trackId",
        track_name as "trackName",
        artist_name as "artistName",
        album_name as "albumName",
        duration_ms as "durationMs",
        popularity,
        timestamp
      FROM spotify_history
      ORDER BY timestamp DESC
    `;
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching tracks:', error);
    throw error;
  }
};

// Get total listening time from database
export const getTotalListeningTime = async (): Promise<number> => {
  try {
    const result = await sql`
      SELECT SUM(duration_ms) as total_ms
      FROM spotify_history
    `;
    
    const totalMs = parseInt(result.rows[0]?.total_ms || '0', 10);
    return isNaN(totalMs) ? 0 : totalMs;
  } catch (error) {
    console.error('Error calculating total listening time:', error);
    return 0;
  }
};

// Get track count
export const getTrackCount = async (): Promise<number> => {
  try {
    const result = await sql`
      SELECT COUNT(*) as count
      FROM spotify_history
    `;
    
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error('Error getting track count:', error);
    return 0;
  }
};

// Clear all tracks
export const clearAllTracks = async (): Promise<void> => {
  try {
    await sql`TRUNCATE TABLE spotify_history RESTART IDENTITY CASCADE`;
    console.log('✓ All tracks cleared from database');
  } catch (error) {
    console.error('Error clearing tracks:', error);
    throw error;
  }
};

