import { useState, useEffect } from 'react';
import {
  getCodeFromUrl,
  exchangeCodeForToken,
  clearTokenFromUrl,
  fetchUserProfile,
  fetchTopTracks,
  fetchTopArtists,
  SpotifyUser,
  SpotifyTrack,
  SpotifyArtist,
} from '@/lib/spotify';

export const useSpotify = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth callback with authorization code
  useEffect(() => {
    const handleCallback = async () => {
      const code = getCodeFromUrl();
      const storedToken = localStorage.getItem('spotify_token');

      if (code) {
        setLoading(true);
        try {
          const accessToken = await exchangeCodeForToken(code);
          localStorage.setItem('spotify_token', accessToken);
          setToken(accessToken);
          clearTokenFromUrl();
        } catch (err) {
          console.error('Token exchange error:', err);
          setError('Failed to authenticate with Spotify. Please try again.');
          clearTokenFromUrl();
        } finally {
          setLoading(false);
        }
      } else if (storedToken) {
        setToken(storedToken);
      }
    };

    handleCallback();
  }, []);

  // Fetch user data when token is available
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [userData, tracksData, artistsData] = await Promise.all([
          fetchUserProfile(token),
          fetchTopTracks(token),
          fetchTopArtists(token),
        ]);
        setUser(userData);
        setTopTracks(tracksData.items);
        setTopArtists(artistsData.items);
      } catch (err) {
        console.error('Data fetch error:', err);
        setError('Failed to fetch Spotify data. Token may have expired.');
        logout();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const logout = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('code_verifier');
    setToken(null);
    setUser(null);
    setTopTracks([]);
    setTopArtists([]);
  };

  return {
    isLoggedIn: !!token,
    user,
    topTracks,
    topArtists,
    loading,
    error,
    logout,
  };
};