# Spotify Tracker

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?style=flat-square&logo=express&logoColor=white)
![Spotify](https://img.shields.io/badge/Spotify_API-1ED760?style=flat-square&logo=spotify&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

A comprehensive dashboard to view your Spotify listening statistics with automatic CSV logging of your listening history.

---

## ✨ Features

- 🔐 Spotify OAuth authentication (PKCE)
- 🎵 View top tracks with customizable limit and listen counts from CSV
- 🎤 View top artists in a grid layout with profile photos and listen counts
- 📅 Time range selection (4 weeks, 6 months, all time)
- 🎧 Currently listening widget with vinyl animation
- 📊 Line graph showing minutes listened per day
- 💾 Automatic CSV logging of all recently played tracks
- ⏰ Background service that updates CSV every 3 minutes
- 📈 Total listening time calculated from CSV (formatted as days, hours, minutes)
- 🎨 Beautiful, modern UI with Tailwind CSS and shadcn/ui components

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Spotify Developer Account

### Setup

1. Create a Spotify Developer App at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add `http://127.0.0.1:8080/callback/` as a Redirect URI in your app settings
3. Create a `.env` file in the root directory with:
```
VITE_SPOTIFY_CLIENT_ID=your_client_id_here
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/callback/
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REFRESH_TOKEN=your_refresh_token_here
```

**Note:** The `SPOTIFY_REFRESH_TOKEN` will be automatically saved to your `.env` file after your first login through the frontend. Alternatively, you can manually add it to `.env` if you already have a refresh token. The backend will use this refresh token to automatically authenticate and update the CSV in the background without requiring frontend login.

### Installation

```sh
# Clone the repository
git clone https://github.com/LauraMQuiros/spotify-stats-panel.git
cd spotify-stats-panel

# Install dependencies
npm install

# Start concurrently "npm run dev:client" "npm run dev:server"
npm run dev:full
```

The frontend will run on `http://127.0.0.1:8080` and the backend API on `http://localhost:3000`. Once the frontend is running, you can log in with your Spotify account and see how it starts logging your songs.

## 📁 Project Structure

```
├── server/
│   ├── index.ts              # Express server setup
│   ├── csvStorage.ts         # CSV storage endpoints
│   └── spotifyService.ts     # Background CSV update service
├── src/
│   ├── components/
│   │   ├── SpotifySidebar.tsx    # Login, user info & vinyl widget
│   │   └── StatsDashboard.tsx    # Stats tables, charts & grids
│   ├── hooks/
│   │   └── useSpotify.ts         # Auth & data fetching
│   ├── lib/
│   │   ├── spotify.ts            # Spotify API utilities
│   │   └── csvDatabase.ts       # CSV database client
│   └── pages/
│       └── Index.tsx             # Main layout
└── data/
    └── spotify_history.csv      # Listening history (auto-generated)
```

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| Tailwind CSS | Styling |
| Express | Backend API Server |
| Recharts | Data Visualization |
| shadcn/ui | UI Components |
| Spotify Web API | Data Source |

## 📊 Features in Detail

### Currently Listening Widget
- Animated vinyl record showing your current or last played track
- Displays album cover art, track name, and artist
- Located in the sidebar

### CSV Logging
- Automatically logs all recently played tracks to `data/spotify_history.csv`
- Background service runs every 3 minutes to update the CSV
- Tracks are deduplicated by track ID + exact timestamp
- Accumulates your complete listening history over time

### Statistics Dashboard
- **Top Tracks**: Customizable limit (default: 5) with listen counts from CSV
- **Top Artists**: Grid layout with profile photos, customizable limit (default: 3)
- **Minutes per Day**: Line graph showing listening trends
- **Total Listening Time**: Calculated from CSV, formatted as "X days, Y hours and Z minutes"
- Time range selector: Last 4 weeks, 6 months, or all time

### Backend API
- RESTful API for CSV storage operations
- Background service for automatic CSV updates
- Token management for Spotify API access

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">
  Made with ❤️ using <a href="https://lovable.dev">Lovable</a>
</p>
