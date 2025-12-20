import { useState, useEffect, useCallback } from 'react';
import {
  getCodeFromUrl,
  exchangeCodeForToken,
  clearTokenFromUrl,
  fetchUserProfile,
  fetchTopTracks,
  fetchTopArtists,
  fetchCurrentlyPlayingTrack,
  fetchRecentlyPlayedTrack,
  fetchRecentlyPlayed,
  SpotifyUser,
  SpotifyTrack,
  SpotifyArtist,
  SpotifyListeningContext,
  SpotifyPlayHistoryEntry,
} from '@/lib/spotify';
import { addTracksToCSV, getTotalListeningTime } from '@/lib/csvDatabase';

export const useSpotify = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [listening, setListening] = useState<SpotifyListeningContext | null>(null);
  const [timeRange, setTimeRange] = useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');
  const [playHistory, setPlayHistory] = useState<SpotifyPlayHistoryEntry[]>([]);
  const [trackPlayCounts, setTrackPlayCounts] = useState<Record<string, number>>({});
  const [artistPlayCounts, setArtistPlayCounts] = useState<Record<string, number>>({});
  const [totalListeningTimeMs, setTotalListeningTimeMs] = useState<number>(0);
  const [minutesPerDay, setMinutesPerDay] = useState<Array<{ date: string; minutes: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PLAY_HISTORY_KEY = 'spotify_play_history';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PLAY_HISTORY_KEY);
      if (saved) {
        const parsed: SpotifyPlayHistoryEntry[] = JSON.parse(saved);
        setPlayHistory(parsed);
        recomputeStats(parsed);
      }
    } catch {
      // ignore corrupted local storage
    }
  }, []);

  const recomputeStats = (entries: SpotifyPlayHistoryEntry[]) => {
    const sorted = [...entries].sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
    const limited = sorted.slice(0, 1000); // keep last 1000 plays

    const trackCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};
    let totalMs = 0;
    const perDay: Record<string, number> = {};

    for (const item of limited) {
      const trackId = item.track.id;
      trackCounts[trackId] = (trackCounts[trackId] ?? 0) + 1;
      totalMs += item.track.duration_ms;
      const dayKey = new Date(item.played_at).toISOString().slice(0, 10);
      perDay[dayKey] = (perDay[dayKey] ?? 0) + item.track.duration_ms;
      for (const artist of item.track.artists) {
        artistCounts[artist.name] = (artistCounts[artist.name] ?? 0) + 1;
      }
    }

    setTrackPlayCounts(trackCounts);
    setArtistPlayCounts(artistCounts);
    setMinutesPerDay(
      Object.entries(perDay)
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([date, ms]) => ({ date, minutes: Math.round(ms / 60000) }))
    );
  };


  const mergeHistory = useCallback((recent: SpotifyPlayHistoryEntry[]) => {
    if (!recent.length) return;
    setPlayHistory(currentHistory => {
      const byKey = new Map<string, SpotifyPlayHistoryEntry>();
      for (const entry of [...currentHistory, ...recent]) {
        const key = `${entry.track.id}-${entry.played_at}`;
        if (!byKey.has(key)) byKey.set(key, entry);
      }
      const merged = Array.from(byKey.values()).sort(
        (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
      );
      const final = merged.slice(0, 1000);
      // Persist to localStorage and recompute stats
      localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(final));
      recomputeStats(final);
      return final;
    });
  }, []);

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
          
          // Send token to backend for background CSV updates
          try {
            await fetch('http://localhost:3000/csv/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: accessToken }),
            });
            console.log('✓ Token sent to backend for CSV auto-updates');
          } catch (err) {
            console.warn('⚠ Failed to send token to backend (CSV auto-updates may not work):', err);
          }
          
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
        
        // Send existing token to backend for background CSV updates
        try {
          await fetch('http://localhost:3000/csv/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: storedToken }),
          });
          console.log('✓ Token sent to backend for CSV auto-updates');
        } catch (err) {
          console.warn('⚠ Failed to send token to backend (CSV auto-updates may not work):', err);
        }
      }
    };

    handleCallback();
  }, []);

  // Fetch user data when token is available or time range changes
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [userData, tracksData, artistsData, currentlyPlaying, recentlyPlayed, recentPlays] = await Promise.all([
          fetchUserProfile(token),
          fetchTopTracks(token, timeRange),
          fetchTopArtists(token, timeRange),
          fetchCurrentlyPlayingTrack(token),
          fetchRecentlyPlayedTrack(token),
          fetchRecentlyPlayed(token, 50), // Will fetch all available pages automatically
        ]);
        setUser(userData);
        setTopTracks(tracksData.items);
        setTopArtists(artistsData.items);
        setListening(currentlyPlaying ?? recentlyPlayed ?? null);
        mergeHistory(recentPlays);
        
        // Store recently played tracks in CSV (with their played_at timestamps)
        if (recentPlays.length > 0) {
          // Send tracks with their played_at timestamps to CSV storage
          await addTracksToCSV(recentPlays);
        }
      } catch (err) {
        console.error('Data fetch error:', err);
        setError('Failed to fetch Spotify data. Token may have expired.');
        logout();
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, timeRange]);

  // Note: CSV updates are now handled by the backend service automatically
  // The backend runs every 3 minutes and updates the CSV using the refresh token from .env

  // Fetch total listening time from CSV periodically
  useEffect(() => {
    const fetchTotalTime = async () => {
      try {
        const totalMs = await getTotalListeningTime();
        setTotalListeningTimeMs(totalMs);
      } catch (err) {
        console.error('Error fetching total listening time:', err);
      }
    };

    // Fetch immediately
    fetchTotalTime();

    // Then fetch every 30 seconds to keep it updated
    const interval = setInterval(fetchTotalTime, 30000);

    return () => clearInterval(interval);
  }, []);

  const logout = () => {
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('code_verifier');
    setToken(null);
    setUser(null);
    setTopTracks([]);
    setTopArtists([]);
    setListening(null);
    setPlayHistory([]);
    setTrackPlayCounts({});
    setArtistPlayCounts({});
    setTotalListeningTimeMs(0);
    setMinutesPerDay([]);
    localStorage.removeItem(PLAY_HISTORY_KEY);
    
    // Clear token from backend
    try {
      fetch('http://localhost:3000/csv/token', {
        method: 'DELETE',
      });
      console.log('✓ Token cleared from backend');
    } catch (err) {
      console.warn('⚠ Failed to clear token from backend:', err);
    }
  };

  return {
    isLoggedIn: !!token,
    user,
    topTracks,
    topArtists,
    listening,
    timeRange,
    setTimeRange,
    trackPlayCounts,
    artistPlayCounts,
    totalListeningTimeMs,
    minutesPerDay,
    loading,
    error,
    logout,
  };
};