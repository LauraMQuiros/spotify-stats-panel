import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Music } from 'lucide-react';
import { loginToSpotify, SpotifyListeningContext, SpotifyUser } from '@/lib/spotify';

interface SpotifySidebarProps {
  isLoggedIn: boolean;
  user: SpotifyUser | null;
  loading: boolean;
  onLogout: () => void;
  listening: SpotifyListeningContext | null;
}

export const SpotifySidebar = ({ isLoggedIn, user, loading, onLogout, listening }: SpotifySidebarProps) => {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6 flex flex-col gap-6">
      <div className="flex items-center gap-2 mb-8">
        <Music className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-sidebar-foreground">Spotify Stats</h1>
      </div>

      {isLoggedIn && listening?.track && (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card/95 p-3 shadow-sm">
          <div className="relative w-full overflow-hidden rounded-xl">
            <div className="absolute inset-0 animate-[spin_14s_linear_infinite] rounded-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 opacity-90" />
            <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 shadow-inner">
              <img
                src={listening.track.album.images?.[0]?.url}
                alt={listening.track.album.name}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {listening.isPlaying ? 'Currently listening' : 'Last listened'}
            </span>
            <div className="text-sidebar-foreground font-semibold leading-tight truncate">
              {listening.track.name}
            </div>
            <div className="text-muted-foreground truncate">
              {listening.track.artists.map(artist => artist.name).join(', ')}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : isLoggedIn && user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user.images?.[0]?.url} />
              <AvatarFallback>{user.display_name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.display_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout} className="w-full">
            Logout
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Spotify account to view your listening statistics.
          </p>
          <Button onClick={loginToSpotify} className="w-full">
            Connect Spotify
          </Button>
        </div>
      )}
    </aside>
  );
};