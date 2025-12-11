import { useSpotify } from '@/hooks/useSpotify';
import { SpotifySidebar } from '@/components/SpotifySidebar';
import { StatsDashboard } from '@/components/StatsDashboard';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { isLoggedIn, user, topTracks, topArtists, loading, error, logout, listening } = useSpotify();
  const navigate = useNavigate();

  // Handle callback redirect - clean up the URL
  useEffect(() => {
    if (window.location.pathname === '/callback/' || window.location.pathname === '/callback') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-background">
      <SpotifySidebar
        isLoggedIn={isLoggedIn}
        user={user}
        loading={loading}
        onLogout={logout}
        listening={listening}
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