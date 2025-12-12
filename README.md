# Spotify Stats Dashboard

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Spotify](https://img.shields.io/badge/Spotify_API-1ED760?style=flat-square&logo=spotify&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

A minimal dashboard to view your Spotify listening statistics including top tracks and artists.

---

## ✨ Features

- 🔐 Spotify OAuth authentication
- 🎵 View top 10 tracks with popularity and duration
- 🎤 View top 10 artists with followers and popularity scores
- 📅 Time range selection (4 weeks, 6 months, all time)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Spotify Developer Account

### Setup

1. Create a Spotify Developer App at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add `http://localhost:8080` as a Redirect URI in your app settings
3. Copy your Client ID and replace `YOUR_SPOTIFY_CLIENT_ID` in `src/lib/spotify.ts`

### Installation

```sh
# Clone the repository
git clone https://github.com/LauraMQuiros/spotify-stats-panel.git
cd spotify-stats-panel

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
src/
├── components/
│   ├── SpotifySidebar.tsx    # Login & user info
│   └── StatsDashboard.tsx    # Stats tables
├── hooks/
│   └── useSpotify.ts         # Auth & data fetching
├── lib/
│   └── spotify.ts            # Spotify API utilities
└── pages/
    └── Index.tsx             # Main layout
```

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| React | UI Framework |
| TypeScript | Type Safety |
| Vite | Build Tool |
| Tailwind CSS | Styling |
| Spotify Web API | Data Source |

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">
  Made with ❤️ using <a href="https://lovable.dev">Lovable</a>
</p>
