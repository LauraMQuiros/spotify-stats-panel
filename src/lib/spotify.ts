// File: `src/lib/spotify.ts`
export const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string) ?? '';
const REGISTERED_REDIRECT = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string) ?? 'http://127.0.0.1:8080/callback/';

function buildRedirectUri(): string {
  try {
    const url = new URL(REGISTERED_REDIRECT);
    const host = url.hostname;
    const isLoopback = host === '127.0.0.1' || host === '::1';
    if (isLoopback && typeof window !== 'undefined') {
      const port = window.location.port;
      if (port) url.port = port;
    }
    return url.toString();
  } catch {
    return REGISTERED_REDIRECT;
  }
}

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-read-playback-state',
  'user-read-currently-playing',
].join(' ');

// PKCE Helper Functions
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64encode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export const getSpotifyAuthUrl = async (): Promise<string> => {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  // Store code verifier for later use
  localStorage.setItem('code_verifier', codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: buildRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const loginToSpotify = async (): Promise<void> => {
  const authUrl = await getSpotifyAuthUrl();
  window.location.href = authUrl;
};

export const getCodeFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
};


export const exchangeCodeForToken = async (code: string): Promise<string> => {
  const codeVerifier = localStorage.getItem('code_verifier');

  if (!codeVerifier) {
    throw new Error('Code verifier not found');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: buildRedirectUri(),
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }

  const data = await response.json();

  // Clean up code verifier
  localStorage.removeItem('code_verifier');

  // Log the full response for debugging
  console.log('Token exchange response:', {
    hasAccessToken: !!data.access_token,
    hasRefreshToken: !!data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  });

  // Store refresh token in localStorage as backup (for manual extraction if needed)
  if (data.refresh_token) {
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
    console.log('✓ Refresh token stored in localStorage (backup)');
  }

  // Send refresh token to backend to save in .env
  if (data.refresh_token) {
    try {
      const refreshResponse = await fetch('http://localhost:3000/csv/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: data.refresh_token }),
      });
      
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        console.log('✓ Refresh token sent to backend for .env storage:', result.message);
        console.log('   You can now use the backend service without frontend login!');
      } else {
        let errorMessage = 'Unknown error';
        // Read response as text first (body stream can only be read once)
        const errorText = await refreshResponse.text();
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If not JSON, use the text as-is
          errorMessage = errorText || errorMessage;
        }
        console.error('✗ Backend rejected refresh token:', errorMessage);
        console.error('   You can manually add it to .env:');
        console.error('   SPOTIFY_REFRESH_TOKEN=<your_refresh_token_here>');
        console.error('   (Refresh token is available in localStorage as spotify_refresh_token)');
      }
    } catch (err) {
      console.error('✗ Failed to send refresh token to backend:', err);
      console.error('   You can manually add it to .env:');
      console.error('   SPOTIFY_REFRESH_TOKEN=<your_refresh_token_here>');
      console.error('   (Refresh token is available in localStorage as spotify_refresh_token)');
    }
  } else {
    console.warn('⚠ No refresh token in response.');
    console.warn('   This happens if you\'ve already authorized the app.');
    console.warn('   To get a refresh token:');
    console.warn('   1. Go to https://www.spotify.com/account/apps/');
    console.warn('   2. Click "Remove Access" for your app');
    console.warn('   3. Log in again through this frontend');
    console.warn('   4. The refresh token will be automatically saved');
  }

  return data.access_token;
};

export const clearTokenFromUrl = (): void => {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname);
};

// Type definitions
export interface SpotifyUser {
  display_name: string;
  email: string;
  id: string;
  images: Array<{ url: string }>;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  followers: {
    total: number;
  };
  images?: Array<{ url: string }>;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  popularity: number;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
}

export interface SpotifyTopTracksResponse {
  items: SpotifyTrack[];
}

export interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[];
}

export interface SpotifyListeningContext {
  track: SpotifyTrack;
  isPlaying: boolean;
}

export interface SpotifyPlayHistoryEntry {
  track: SpotifyTrack;
  played_at: string;
}

// API Functions
export const fetchSpotifyData = async (endpoint: string, token: string) => {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch from Spotify');
  return response.json();
};

export const fetchUserProfile = async (token: string): Promise<SpotifyUser> => {
  return fetchSpotifyData('/me', token);
};

export const fetchTopTracks = async (token: string, timeRange: string = 'medium_term'): Promise<SpotifyTopTracksResponse> => {
  return fetchSpotifyData(`/me/top/tracks?time_range=${timeRange}&limit=20`, token);
};

export const fetchTopArtists = async (token: string, timeRange: string = 'medium_term'): Promise<SpotifyTopArtistsResponse> => {
  return fetchSpotifyData(`/me/top/artists?time_range=${timeRange}&limit=20`, token);
};

// Fetch a single track from Spotify (currently playing or recently played)
const fetchSingleTrack = async (
  token: string,
  type: 'currently-playing' | 'recently-played'
): Promise<SpotifyListeningContext | null> => {
  const endpoint = type === 'currently-playing'
    ? 'https://api.spotify.com/v1/me/player/currently-playing'
    : 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (type === 'currently-playing' && response.status === 204) {
    // 204 No Content means nothing is currently playing
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch ${type.replace('-', ' ')} track`);
  }

  const data = await response.json();

  if (type === 'currently-playing') {
    if (!data?.item) return null;
    return { track: data.item as SpotifyTrack, isPlaying: !!data.is_playing };
  } else {
    const recentTrack = data?.items?.[0]?.track as SpotifyTrack | undefined;
    if (!recentTrack) return null;
    return { track: recentTrack, isPlaying: false };
  }
};

export const fetchCurrentlyPlayingTrack = async (token: string): Promise<SpotifyListeningContext | null> => {
  return fetchSingleTrack(token, 'currently-playing');
};

export const fetchRecentlyPlayedTrack = async (token: string): Promise<SpotifyListeningContext | null> => {
  return fetchSingleTrack(token, 'recently-played');
};

export const fetchRecentlyPlayed = async (token: string): Promise<SpotifyPlayHistoryEntry[]> => {
  const allItems: SpotifyPlayHistoryEntry[] = [];
  let before: number | null = null;
  let hasMore = true;
  let pageCount = 0;
  const maxLimit = 50; // Spotify API maximum (API-imposed limit)

  // Fetch ALL available pages using 'before' parameter to paginate through entire history
  // This function always fetches all available history (not limited)
  // Note: Spotify API only provides last ~3 days of history, but we'll get everything available
  // Over time, as you keep the app running, it will accumulate your complete listening history
  while (hasMore) {
    let url = `https://api.spotify.com/v1/me/player/recently-played?limit=${maxLimit}`;
    if (before) {
      url += `&before=${before}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recently played tracks');
    }

    const data = await response.json();
    const items = (data?.items ?? []) as SpotifyPlayHistoryEntry[];
    
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    allItems.push(...items);
    pageCount++;

    // Continue paginating: use the oldest item's timestamp as 'before' for next page
    // This allows us to fetch ALL available history (up to Spotify's ~3 day limit)
    if (items.length > 0) {
      // Get the oldest timestamp from the current batch (last item is oldest)
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

  console.log(`Fetched ${allItems.length} tracks across ${pageCount} pages`);
  return allItems;
};