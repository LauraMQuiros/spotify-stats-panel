import { useSpotify } from '@/hooks/useSpotify';
import { SpotifySidebar } from '@/components/SpotifySidebar';
import { StatsDashboard } from '@/components/StatsDashboard';

const Index = () => {
  const { isLoggedIn, user, topTracks, topArtists, loading, error, logout } = useSpotify();

  return (
    <div className="flex min-h-screen bg-background">
      <SpotifySidebar
        isLoggedIn={isLoggedIn}
        user={user}
        loading={loading}
        onLogout={logout}
      />
      <StatsDashboard
        topTracks={topTracks}
        topArtists={topArtists}
        loading={loading}
        isLoggedIn={isLoggedIn}
      />
      {error && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground p-3 rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default Index;
