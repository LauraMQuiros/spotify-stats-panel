// File: `src/components/SpotifySidebar.tsx`
import React, { useEffect, useState } from 'react';
import { loginToSpotify, getTokenFromUrl, clearTokenFromUrl } from '../lib/spotify';

const TOKEN_KEY = 'spotify_token';

export default function SpotifySidebar() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const t = getTokenFromUrl();
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      clearTokenFromUrl();
    }
  }, []);

  return (
    <aside className="p-4">
      {token ? (
        <div>
          <p className="mb-2">Spotify connected</p>
          <button
            className="btn"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setToken(null);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button className="btn" onClick={() => loginToSpotify()}>
          Connect Spotify
        </button>
      )}
    </aside>
  );
}
