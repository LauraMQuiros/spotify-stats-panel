// api/cron.ts
// Vercel Cron Job endpoint for updating Spotify listening history (using Neon Postgres)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { initDatabase, addTracksToDatabase } from '../server/db';

// Get Spotify credentials from environment
const CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

// Token cache (in-memory, resets on cold start)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Refresh access token using refresh token from environment
const refreshAccessToken = async (): Promise<string> => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing Spotify credentials. Please set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });

  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000 || 3600 * 1000);
  
  return cachedAccessToken;
};

// Get valid access token (use cached if still valid, otherwise refresh)
const getValidAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  if (REFRESH_TOKEN && CLIENT_ID && CLIENT_SECRET) {
    try {
      return await refreshAccessToken();
    } catch (error: any) {
      console.error('Failed to refresh token:', error.message);
      return null;
    }
  }

  return null;
};

// Fetch recently played tracks from Spotify (with pagination)
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

    // Continue pagination only if we got a full page
    if (items.length === maxLimit) {
      const oldestItem = items[items.length - 1];
      before = new Date(oldestItem.played_at).getTime();
    } else {
      hasMore = false;
    }
  }

  return allItems;
};

// Main cron job handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Cron job started: Fetching recently played tracks...');

    // Initialize database if needed
    await initDatabase();

    // Get valid access token
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      console.log('⏸ Skipping update: No valid token available');
      if (!REFRESH_TOKEN) {
        console.log('   ℹ Tip: Add SPOTIFY_REFRESH_TOKEN to environment variables');
      }
      return res.status(200).json({
        success: false,
        message: 'No valid token available',
      });
    }

    // Fetch recently played tracks
    console.log('🔄 Fetching recently played tracks...');
    const tracks = await fetchRecentlyPlayed(accessToken);
    console.log(`📊 Fetched ${tracks.length} recently played tracks`);

    if (tracks.length > 0) {
      // Add tracks to database
      const addedCount = await addTracksToDatabase(tracks);

      if (addedCount > 0) {
        console.log(`✅ Database updated: Added ${addedCount} new tracks`);
        return res.status(200).json({
          success: true,
          message: `Added ${addedCount} new tracks`,
          fetched: tracks.length,
          added: addedCount,
        });
      } else {
        console.log(`ℹ Database update: No new tracks to add (all ${tracks.length} already exist)`);
        return res.status(200).json({
          success: true,
          message: 'No new tracks to add',
          fetched: tracks.length,
          added: 0,
        });
      }
    } else {
      console.log('ℹ No tracks found in recently played history');
      return res.status(200).json({
        success: true,
        message: 'No tracks found',
        fetched: 0,
        added: 0,
      });
    }
  } catch (error: any) {
    console.error('❌ Cron job error:', error.message || error);

    if (error.message?.includes('Token expired') || error.message?.includes('401')) {
      return res.status(401).json({
        success: false,
        error: 'Token expired or invalid',
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update database',
    });
  }
}

