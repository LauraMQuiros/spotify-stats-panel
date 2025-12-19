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
import { SpotifyTrack, SpotifyArtist } from '@/lib/spotify';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

interface StatsDashboardProps {
  topTracks: SpotifyTrack[];
  topArtists: SpotifyArtist[];
  loading: boolean;
  isLoggedIn: boolean;
  timeRange: 'short_term' | 'medium_term' | 'long_term';
  onTimeRangeChange: (range: 'short_term' | 'medium_term' | 'long_term') => void;
  trackPlayCounts: Record<string, number>;
  artistPlayCounts: Record<string, number>;
  minutesListened: number;
  minutesPerDay: Array<{ date: string; minutes: number }>;
}

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  minutesListened,
  minutesPerDay,
}: StatsDashboardProps) => {
  const minutesChartData = [...minutesPerDay].slice(0, 14).reverse();

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
          <span className="font-semibold">Minutes listened (tracked)</span>
          <span className="text-base font-bold">{minutesListened}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tracked locally from your recent plays; builds up as you keep listening.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-foreground">Top Tracks</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Track</TableHead>
              <TableHead>Artist</TableHead>
                <TableHead className="w-28 text-right">Listens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topTracks.map((track, index) => (
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
          <h3 className="mb-3 text-lg font-semibold text-foreground">Top Artists</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artist</TableHead>
                <TableHead className="w-28 text-right">Listens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topArtists.map((artist, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{artist.name}</TableCell>
                  <TableCell className="text-right">
                    {artistPlayCounts[artist.name] ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Minutes per Day</h4>
            <ChartContainer
              className="h-64"
              config={{
                minutes: { label: 'Minutes', color: 'hsl(var(--primary))' },
              }}
            >
              <BarChart data={minutesChartData}>
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
                <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold text-foreground">Minutes per Day (tracked)</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="w-32 text-right">Minutes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {minutesPerDay.map(entry => (
              <TableRow key={entry.date}>
                <TableCell>{entry.date}</TableCell>
                <TableCell className="text-right">{entry.minutes}</TableCell>
              </TableRow>
            ))}
            {!minutesPerDay.length && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No tracked listening yet. Keep listening to build history.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
};
