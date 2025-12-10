import { useState, useEffect } from 'react';
import {
  getTokenFromUrl,
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

  useEffect(() => {
    const storedToken = localStorage.getItem('spotify_token');
    const urlToken = getTokenFromUrl();

    if (urlToken) {
      localStorage.setItem('spotify_token', urlToken);
      setToken(urlToken);
      clearTokenFromUrl();
    } else if (storedToken) {
      setToken(storedToken);
    }
  }, []);

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
