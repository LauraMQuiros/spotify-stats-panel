// server/spotifyService.ts
// Background service to periodically fetch recently played tracks and update CSV

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { addTracksToCSVFileSafely } from './csvUtils';

dotenv.config();

const CSV_FILE_PATH = path.join(process.cwd(), 'data', 'spotify_history.csv');
const ENV_FILE_PATH = path.join(process.cwd(), '.env');

// Get credentials from .env
const CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// Use let instead of const so we can update it when saveRefreshTokenToEnv is called
let REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

// Store token in memory (cached access token)
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Set the token (called by frontend - for backward compatibility)
export const setToken = (token: string) => {
  cachedAccessToken = token;
  // Set expiration to 1 hour from now (Spotify tokens typically last 1 hour)
  tokenExpiresAt = Date.now() + 60 * 60 * 1000;
  console.log('✓ Spotify token stored for background CSV updates');
};

// Clear the token
export const clearToken = () => {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  console.log('✓ Spotify token cleared');
};

// Save refresh token to .env file
export const saveRefreshTokenToEnv = (refreshToken: string): void => {
  try {
    console.log(`Attempting to save refresh token to ${ENV_FILE_PATH}`);
    
    let envContent = '';
    if (fs.existsSync(ENV_FILE_PATH)) {
      envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
      console.log(`✓ Read existing .env file (${envContent.length} characters)`);
    } else {
      console.log('⚠ .env file does not exist, will create new one');
    }

    // Remove trailing newlines and whitespace
    envContent = envContent.trimEnd();

    // Check if SPOTIFY_REFRESH_TOKEN already exists
    if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
      // Replace existing refresh token (handles cases with or without quotes)
      const beforeLength = envContent.length;
      envContent = envContent.replace(
        /SPOTIFY_REFRESH_TOKEN=.*/g,
        `SPOTIFY_REFRESH_TOKEN=${refreshToken}`
      );
      console.log(`✓ Replaced existing SPOTIFY_REFRESH_TOKEN (${beforeLength} -> ${envContent.length} chars)`);
    } else {
      // Append new refresh token with proper newline
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `SPOTIFY_REFRESH_TOKEN=${refreshToken}\n`;
      console.log(`✓ Added new SPOTIFY_REFRESH_TOKEN to .env`);
    }

    fs.writeFileSync(ENV_FILE_PATH, envContent, 'utf8');
    console.log(`✓ Refresh token saved to .env file successfully (file size: ${envContent.length} characters)`);
    
    // Update the in-memory variable so it's immediately available
    REFRESH_TOKEN = refreshToken;
    // Also update process.env so dotenv.config() will pick it up if called again
    process.env.SPOTIFY_REFRESH_TOKEN = refreshToken;
    
    // Verify it was saved
    const verifyContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    if (verifyContent.includes(`SPOTIFY_REFRESH_TOKEN=${refreshToken}`)) {
      console.log('✓ Verified: Refresh token is in .env file and in-memory variable updated');
    } else {
      console.error('✗ Verification failed: Refresh token not found in .env after write');
    }
  } catch (error: any) {
    console.error('✗ Error saving refresh token to .env:', error);
    console.error('  Error details:', error.message, error.stack);
    throw error; // Re-throw so the API endpoint can handle it
  }
};

// Refresh access token using refresh token from .env
// Uses Authorization Code flow format (with client_id and client_secret in Authorization header)
const refreshAccessToken = async (): Promise<string> => {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error('Missing Spotify credentials in .env. Please set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN');
  }

  // For Authorization Code flow: client_id and client_secret go in Authorization header
  // Body only contains grant_type and refresh_token (NOT client_id)
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });

  // Base64 encode client_id:client_secret for Authorization header
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
    let errorMessage = 'Token refresh failed';
    try {
      const error = JSON.parse(errorText);
      errorMessage = error.error_description || error.error || errorMessage;
      
      // If refresh token is revoked, provide helpful message
      if (error.error === 'invalid_grant' || errorMessage.toLowerCase().includes('revoked')) {
        console.error('\n❌ REFRESH TOKEN REVOKED OR INVALID');
        console.error('   To fix this:');
        console.error('   1. Go to https://www.spotify.com/account/apps/ and revoke access to your app');
        console.error('   2. Log in again through the frontend (http://127.0.0.1:8080)');
        console.error('   3. The refresh token will be automatically saved to .env');
        console.error('   4. Or manually add SPOTIFY_REFRESH_TOKEN=your_token to .env\n');
      }
    } catch {
      errorMessage = `${errorMessage}: ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  // Set expiration (Spotify tokens typically last 1 hour, expires_in is in seconds)
  tokenExpiresAt = Date.now() + (data.expires_in * 1000 || 3600 * 1000);

  // If a new refresh token is provided, update .env
  // Note: Spotify may not always return a new refresh token - continue using existing one if not provided
  if (data.refresh_token && data.refresh_token !== REFRESH_TOKEN) {
    saveRefreshTokenToEnv(data.refresh_token);
    console.log('✓ New refresh token received and saved');
  }

  console.log('✓ Access token refreshed successfully');
  return cachedAccessToken;
};

// Get a valid access token (refresh if needed)
const getValidAccessToken = async (): Promise<string | null> => {
  // If we have a cached token that's still valid, use it
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  // If refresh token is available in .env, use it to get a new access token
  if (REFRESH_TOKEN && CLIENT_ID && CLIENT_SECRET) {
    try {
      console.log('🔄 Refreshing access token using refresh token from .env...');
      return await refreshAccessToken();
    } catch (error: any) {
      console.error('❌ Failed to refresh token:', error.message);
      return null;
    }
  }

  // Fallback to cached token (from frontend)
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  return null;
};

// Check if token is available
export const hasToken = (): boolean => {
  return cachedAccessToken !== null || REFRESH_TOKEN !== undefined;
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
      
      // Only continue if we got a full page (50 items) - this indicates there might be more data
      // If we got fewer than maxLimit items, we've reached the end of available history
      if (items.length === maxLimit) {
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


// Update CSV with new tracks (uses safe wrapper with locking)
const updateCSV = async (tracks: any[]): Promise<number> => {
  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error('CSV file does not exist');
  }

  // Use safe wrapper that handles file read and write with locking
  return await addTracksToCSVFileSafely(CSV_FILE_PATH, tracks);
};

// Fetch and update CSV
const fetchAndUpdateCSV = async (): Promise<void> => {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    console.log('⏸ Skipping CSV update: No valid token available');
    if (!REFRESH_TOKEN) {
      console.log('   ℹ Tip: Add SPOTIFY_REFRESH_TOKEN to .env for automatic authentication');
    }
    return;
  }

  try {
    console.log('🔄 Fetching recently played tracks for CSV update...');
    const tracks = await fetchRecentlyPlayed(accessToken);
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
    if (error.message?.includes('Token expired') || error.message?.includes('401')) {
      console.error('❌ Token expired - attempting to refresh...');
      // Clear cached token and try to refresh
      cachedAccessToken = null;
      tokenExpiresAt = 0;
      // Will automatically refresh on next call
    } else {
      console.error('❌ Error updating CSV:', error.message || error);
    }
  }
};

// Start the periodic CSV update service
let updateInterval: NodeJS.Timeout | null = null;
let isUpdating = false; // Lock to prevent concurrent execution

// Fetch and update CSV with locking mechanism
const fetchAndUpdateCSVWithLock = async (): Promise<void> => {
  // Skip if already updating
  if (isUpdating) {
    console.log('⏸ CSV update already in progress, skipping...');
    return;
  }

  isUpdating = true;
  try {
    await fetchAndUpdateCSV();
  } finally {
    isUpdating = false;
  }
};

export const startCSVUpdateService = (intervalMinutes: number = 3) => {
  if (updateInterval) {
    console.log('⚠ CSV update service already running');
    return;
  }

  console.log(`🚀 Starting CSV auto-update service (every ${intervalMinutes} minutes)`);
  
  // Fetch immediately on startup (fire and forget, but locked)
  fetchAndUpdateCSVWithLock();
  
  // Then fetch periodically
  updateInterval = setInterval(() => {
    fetchAndUpdateCSVWithLock();
  }, intervalMinutes * 60 * 1000);
};

export const stopCSVUpdateService = () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('⏹ Stopped CSV update service');
  }
};

