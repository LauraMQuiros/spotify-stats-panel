import { useState, useEffect } from 'react';
import { addTracksToCSV } from '@/lib/csvDatabase';
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
  const [minutesListened, setMinutesListened] = useState<number>(0);
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

  const persistHistory = (entries: SpotifyPlayHistoryEntry[]) => {
    setPlayHistory(entries);
    localStorage.setItem(PLAY_HISTORY_KEY, JSON.stringify(entries));
    recomputeStats(entries);
  };

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
    setMinutesListened(Math.round(totalMs / 60000));
    setMinutesPerDay(
      Object.entries(perDay)
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([date, ms]) => ({ date, minutes: Math.round(ms / 60000) }))
    );
  };

  const mergeHistory = (recent: SpotifyPlayHistoryEntry[]) => {
    if (!recent.length) return;
    const byKey = new Map<string, SpotifyPlayHistoryEntry>();
    for (const entry of [...playHistory, ...recent]) {
      const key = `${entry.track.id}-${entry.played_at}`;
      if (!byKey.has(key)) byKey.set(key, entry);
    }
    const merged = Array.from(byKey.values()).sort(
      (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
    );
    persistHistory(merged.slice(0, 1000));
  };

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
          fetchRecentlyPlayed(token),
        ]);
        setUser(userData);
        setTopTracks(tracksData.items);
        setTopArtists(artistsData.items);
        // Save tracks to CSV database
        if (tracksData.items.length > 0) {
          addTracksToCSV(tracksData.items);
        }
        setListening(currentlyPlaying ?? recentlyPlayed ?? null);
        mergeHistory(recentPlays);
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
    setMinutesListened(0);
    setMinutesPerDay([]);
    localStorage.removeItem(PLAY_HISTORY_KEY);
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
    minutesListened,
    minutesPerDay,
    loading,
    error,
    logout,
  };
};