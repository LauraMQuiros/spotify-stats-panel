import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { SpotifyTrack, SpotifyArtist } from '@/lib/spotify';
import { CartesianGrid, XAxis, YAxis, Line, LineChart } from 'recharts';
import { useState } from 'react';

interface StatsDashboardProps {
  topTracks: SpotifyTrack[];
  topArtists: SpotifyArtist[];
  loading: boolean;
  isLoggedIn: boolean;
  timeRange: 'short_term' | 'medium_term' | 'long_term';
  onTimeRangeChange: (range: 'short_term' | 'medium_term' | 'long_term') => void;
  trackPlayCounts: Record<string, number>;
  artistPlayCounts: Record<string, number>;
  totalListeningTimeMs: number;
  minutesPerDay: Array<{ date: string; minutes: number }>;
}

const formatTotalListeningTime = (totalMs: number): string => {
  const totalSeconds = Math.floor(totalMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);

  if (parts.length === 0) return '0 minutes';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`;
};

const timeRangeLabels: Record<StatsDashboardProps['timeRange'], string> = {
  short_term: 'Last 4 weeks',
  medium_term: 'Last 6 months',
  long_term: 'All time',
};

export const StatsDashboard = ({
  topTracks,
  topArtists,
  loading,
  isLoggedIn,
  timeRange,
  onTimeRangeChange,
  trackPlayCounts,
  artistPlayCounts,
  totalListeningTimeMs,
  minutesPerDay,
}: StatsDashboardProps) => {
  const [artistLimit, setArtistLimit] = useState<number>(3);
  const [trackLimit, setTrackLimit] = useState<number>(5);
  const minutesChartData = [...minutesPerDay].slice(0, 14).reverse();
  const displayedArtists = topArtists.slice(0, artistLimit);
  const displayedTracks = topTracks.slice(0, trackLimit);

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
    <main className="flex-1 p-8 space-y-6 overflow-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Top Tracks & Artists</h2>
          <p className="text-sm text-muted-foreground">Based on your listening for the selected period.</p>
        </div>
        <Select value={timeRange} onValueChange={value => onTimeRangeChange(value as StatsDashboardProps['timeRange'])}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="short_term">Last 4 weeks</SelectItem>
            <SelectItem value="medium_term">Last 6 months</SelectItem>
            <SelectItem value="long_term">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">Showing: {timeRangeLabels[timeRange]}</div>
      <div className="rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-foreground">
          <span className="font-semibold">Total listening time (tracked)</span>
          <span className="text-base font-bold">{formatTotalListeningTime(totalListeningTimeMs)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Top Tracks</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="track-limit" className="text-xs text-muted-foreground">
                Limit:
              </label>
              <Input
                id="track-limit"
                type="number"
                min="1"
                max={topTracks.length}
                value={trackLimit}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0 && value <= topTracks.length) {
                    setTrackLimit(value);
                  }
                }}
                className="h-8 w-16 text-center"
              />
            </div>
          </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Track</TableHead>
              <TableHead>Artist</TableHead>
                <TableHead className="w-28 text-right">Listens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedTracks.map((track, index) => (
              <TableRow key={index}>
                  <TableCell className="font-medium">{track.name}</TableCell>
                  <TableCell className="text-muted-foreground">{track.artists.map(a => a.name).join(', ')}</TableCell>
                  <TableCell className="text-right">
                    {trackPlayCounts[track.id] ?? 0}
                  </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

        <section className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Top Artists</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="artist-limit" className="text-xs text-muted-foreground">
                Limit:
              </label>
              <Input
                id="artist-limit"
                type="number"
                min="1"
                max={topArtists.length}
                value={artistLimit}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value) && value > 0 && value <= topArtists.length) {
                    setArtistLimit(value);
                  }
                }}
                className="h-8 w-16 text-center"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {displayedArtists.map((artist, index) => {
              const artistImage = artist.images?.[0]?.url;
              const initials = artist.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={artist.id || index} className="flex flex-col items-center gap-1">
                  <div className="relative h-40 w-40 overflow-hidden rounded-md border border-border/50 bg-muted">
                    {artistImage ? (
                      <>
                        <img
                          src={artistImage}
                          alt={artist.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="hidden h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                          {initials}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground tracking-tight italic">{artist.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {artistPlayCounts[artist.name] ?? 0} listens
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Minutes per Day</h4>
            <ChartContainer
              className="h-64"
              config={{
                minutes: { label: 'Minutes', color: 'hsl(var(--primary))' },
              }}
            >
              <LineChart data={minutesChartData}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                  width={40}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Line 
                  type="monotone" 
                  dataKey="minutes" 
                  stroke="var(--color-minutes)" 
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-minutes)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </section>
      </div>
    </main>
  );
};
