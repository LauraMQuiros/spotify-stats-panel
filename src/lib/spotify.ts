// File: `src/lib/spotify.ts`
export const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string) ?? '';
const REGISTERED_REDIRECT = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string) ?? 'http://127.0.0.1:8080/callback/';

function buildRedirectUri(): string {
  try {
    const url = new URL(REGISTERED_REDIRECT);
    const host = url.hostname;
    const isLoopback = host === '127.0.0.1:8080' || host === '::1';
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

export const getSpotifyAuthUrl = (): string => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: buildRedirectUri(),
    scope: SCOPES,
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const loginToSpotify = (): void => {
  window.location.href = getSpotifyAuthUrl();
};

export const getTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.substring(1));
  return params.get('access_token');
};

export const clearTokenFromUrl = (): void => {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
};

export const fetchSpotifyData = async (endpoint: string, token: string) => {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch from Spotify');
  return response.json();
};
