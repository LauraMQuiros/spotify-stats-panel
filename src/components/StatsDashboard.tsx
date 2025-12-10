import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SpotifyTrack, SpotifyArtist } from '@/lib/spotify';

interface StatsDashboardProps {
  topTracks: SpotifyTrack[];
  topArtists: SpotifyArtist[];
  loading: boolean;
  isLoggedIn: boolean;
}

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const StatsDashboard = ({ topTracks, topArtists, loading, isLoggedIn }: StatsDashboardProps) => {
  if (!isLoggedIn) {
    return (
      <main className="flex-1 p-8">
        <p className="text-muted-foreground">Please log in to view your Spotify statistics.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex-1 p-8">
        <p className="text-muted-foreground">Loading statistics...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 space-y-8 overflow-auto">
      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Top Tracks</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead>Popularity</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topTracks.map((track, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{track.name}</TableCell>
                <TableCell>{track.artists.map(a => a.name).join(', ')}</TableCell>
                <TableCell>{track.album.name}</TableCell>
                <TableCell>{track.popularity}</TableCell>
                <TableCell>{formatDuration(track.duration_ms)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Top Artists</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Popularity</TableHead>
              <TableHead>Followers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topArtists.map((artist, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{artist.name}</TableCell>
                <TableCell>{artist.popularity}</TableCell>
                <TableCell>{artist.followers.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </main>
  );
};
