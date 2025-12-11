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

export const getTokenFromUrl = (): string | null => {
  // This is now used only for checking existing tokens
  // The actual token exchange happens in exchangeCodeForToken
  return null;
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