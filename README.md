# Spotify Stats Dashboard

A simple dashboard to view your Spotify listening statistics including top tracks and artists.

## Features

- Spotify OAuth authentication
- View top 10 tracks with popularity and duration
- View top 10 artists with followers and popularity scores
- Time range selection (4 weeks, 6 months, all time)

## Setup

1. Create a Spotify Developer App at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add `http://localhost:8080` as a Redirect URI in your app settings
3. Copy your Client ID and replace `YOUR_SPOTIFY_CLIENT_ID` in `src/lib/spotify.ts`

## Development

```sh
npm install
npm run dev
```

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Spotify Web API
