import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Music } from 'lucide-react';
import { loginToSpotify, SpotifyUser } from '@/lib/spotify';

interface SpotifySidebarProps {
  isLoggedIn: boolean;
  user: SpotifyUser | null;
  loading: boolean;
  onLogout: () => void;
}

export const SpotifySidebar = ({ isLoggedIn, user, loading, onLogout }: SpotifySidebarProps) => {
  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <Music className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-sidebar-foreground">Spotify Stats</h1>
      </div>

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