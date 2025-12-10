import { Button } from '@/components/ui/button';
import { getSpotifyAuthUrl, SpotifyUser } from '@/lib/spotify';
import { LogOut, Music } from 'lucide-react';

interface SpotifySidebarProps {
  isLoggedIn: boolean;
  user: SpotifyUser | null;
  loading: boolean;
  onLogout: () => void;
}

export const SpotifySidebar = ({ isLoggedIn, user, loading, onLogout }: SpotifySidebarProps) => {
  const handleLogin = () => {
    window.location.href = getSpotifyAuthUrl();
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <Music className="h-6 w-6 text-sidebar-primary" />
        <h1 className="text-lg font-bold text-sidebar-foreground">Spotify Stats</h1>
      </div>

      <div className="flex-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isLoggedIn && user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {user.images?.[0] && (
                <img
                  src={user.images[0].url}
                  alt={user.display_name}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium text-sidebar-foreground">{user.display_name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="text-sm text-sidebar-foreground space-y-1">
              <p>Followers: {user.followers.total}</p>
              <p>Plan: {user.product}</p>
              <p>Country: {user.country}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not logged in</p>
        )}
      </div>

      <div className="mt-auto">
        {isLoggedIn ? (
          <Button variant="outline" className="w-full" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        ) : (
          <Button className="w-full" onClick={handleLogin}>
            Login with Spotify
          </Button>
        )}
      </div>
    </aside>
  );
};
