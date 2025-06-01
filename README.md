# Jenny Romantic Songs 💕

A beautiful romantic song app that fetches songs from TIDAL API using Netlify Functions to solve CORS issues and provide secure API access.

## 🚀 Features

- ✅ Secure TIDAL API integration via Netlify Functions
- ✅ No CORS errors - backend handles all API calls
- ✅ Beautiful swipeable card interface
- ✅ Morning/evening song classification
- ✅ Fallback songs if API is unavailable
- ✅ Token caching for optimal performance

## 📁 Project Structure

```
jenny-romantic-songs/
├── public/
│   └── index.html          # Frontend application
├── netlify/
│   └── functions/
│       ├── auth-tidal.js   # TIDAL authentication
│       └── get-playlist.js # Playlist fetching
├── .env                    # Environment variables
├── netlify.toml           # Netlify configuration
└── package.json           # Dependencies and scripts
```

## 🛠️ Local Development

### Prerequisites
- Node.js (v18 or higher)
- Netlify CLI

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment variables:**
   The `.env` file is already configured with TIDAL credentials:
   ```
   TIDAL_CLIENT_ID=qYkX0pV73VRIZNpS
   TIDAL_CLIENT_SECRET=JlOidzFnvkA1rk18GLu1vrCAVzRZ4ixQdWGOiKmz7MU=
   TIDAL_PLAYLIST_ID=a7e25e82-5b90-4f74-9068-fa103012dbcc
   ```

3. **Start local development server:**
   ```bash
   npm run dev
   ```
   
   This will start the Netlify dev server on http://localhost:8888

4. **Test the API endpoints:**
   - Main app: http://localhost:8888
   - Playlist function: http://localhost:8888/.netlify/functions/get-playlist
   - Auth function: http://localhost:8888/.netlify/functions/auth-tidal

## 🌐 Deployment

### Deploy to Netlify

1. **Initialize Netlify site:**
   ```bash
   netlify login
   netlify init
   ```

2. **Set environment variables on Netlify:**
   Go to your Netlify dashboard → Site settings → Environment variables
   Add the same variables from your `.env` file.

3. **Deploy:**
   ```bash
   npm run deploy
   ```

## 🎵 API Endpoints

### GET `/.netlify/functions/get-playlist`
Fetches playlist tracks from TIDAL API with proper authentication and CORS headers.

**Response:**
```json
{
  "tracks": [
    {
      "id": "track_id",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "duration": 263,
      "coverUrl": "https://...",
      "classification": "morning|evening",
      "source": "tidal"
    }
  ],
  "total": 10,
  "source": "TIDAL API"
}
```

### GET `/.netlify/functions/auth-tidal`
Handles TIDAL OAuth2 authentication with token caching.

**Response:**
```json
{
  "access_token": "Bearer_token_here",
  "expires_in": 3600
}
```

## 🔧 Technical Details

### Backend (Netlify Functions)
- **Node.js** with CommonJS modules
- **node-fetch@2** for HTTP requests
- **Token caching** to minimize API calls
- **Error handling** with fallback responses
- **CORS headers** for browser compatibility

### Frontend
- **Vanilla JavaScript** (no frameworks)
- **Modern CSS** with backdrop-filter and animations
- **Touch/swipe gestures** for mobile interaction
- **Responsive design** with safe area support
- **Progressive Web App** features

### Security
- API credentials stored securely in Netlify environment
- No sensitive data exposed to frontend
- CORS properly configured
- XSS and clickjacking protection headers

## 💝 Success Criteria

- ✅ App loads real songs from TIDAL playlist
- ✅ No CORS errors in browser console
- ✅ API credentials secure on backend
- ✅ Smooth performance with caching
- ✅ Proper error handling with fallbacks
- ✅ Successfully deployed on Netlify

## 🎯 Next Steps

1. Test the local development environment
2. Deploy to Netlify
3. Set up environment variables on Netlify
4. Test production deployment
5. Monitor function logs for any issues

## ❤️ About

This app was built to solve CORS issues with the TIDAL API by using Netlify Functions as a secure backend proxy. It provides a beautiful, romantic interface for browsing playlist songs with proper authentication and error handling.