const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'; // User needs to replace this
const REDIRECT_URI = window.location.origin + '/';
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
  'user-read-playback-state',
  'user-read-currently-playing',
].join(' ');

export const getSpotifyAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'token',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const getTokenFromUrl = (): string | null => {
  const hash = window.location.hash;
  if (!hash) return null;
  
  const params = new URLSearchParams(hash.substring(1));
  return params.get('access_token');
};

export const clearTokenFromUrl = () => {
  window.history.replaceState(null, '', window.location.pathname);
};

export interface SpotifyUser {
  display_name: string;
  email: string;
  followers: { total: number };
  images: { url: string }[];
  product: string;
  country: string;
}

export interface SpotifyTrack {
  name: string;
  artists: { name: string }[];
  album: { name: string };
  popularity: number;
  duration_ms: number;
}

export interface SpotifyArtist {
  name: string;
  popularity: number;
  followers: { total: number };
  genres: string[];
}

export const fetchSpotifyData = async (endpoint: string, token: string) => {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch from Spotify');
  return response.json();
};

export const fetchUserProfile = (token: string): Promise<SpotifyUser> => 
  fetchSpotifyData('/me', token);

export const fetchTopTracks = (token: string): Promise<{ items: SpotifyTrack[] }> => 
  fetchSpotifyData('/me/top/tracks?limit=20&time_range=medium_term', token);

export const fetchTopArtists = (token: string): Promise<{ items: SpotifyArtist[] }> => 
  fetchSpotifyData('/me/top/artists?limit=20&time_range=medium_term', token);
