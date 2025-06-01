# 💕 Jenny's Romantic Songs - TIDAL Playlist App

A beautiful web application that fetches and displays romantic songs from a TIDAL playlist using Netlify serverless functions.

## 🚀 Quick Start for OpenAI Codex

This project is **ready to run** with Netlify Dev. All dependencies and configurations are already set up.

### Prerequisites
- Node.js (v14+)
- npm or yarn
- TIDAL Developer API credentials

### 🏃‍♂️ Run Locally
```bash
npm install
npx netlify dev
```

The app will be available at: **http://localhost:8888**

## 📁 Project Structure

```
jenny-romantic-songs/
├── netlify/
│   └── functions/
│       ├── auth-tidal.js       # TIDAL OAuth authentication
│       └── get-playlist.js     # Fetch playlist from TIDAL API
├── public/
│   └── index.html             # Beautiful frontend interface
├── package.json               # Dependencies & scripts
├── netlify.toml              # Netlify configuration
├── .env                      # Environment variables (see setup)
└── .gitignore                # Git ignore patterns
```

## 🔧 Environment Setup

Create a `.env` file with your TIDAL credentials:

```env
TIDAL_CLIENT_ID=your_client_id_here
TIDAL_CLIENT_SECRET=your_client_secret_here
TIDAL_PLAYLIST_ID=your_playlist_id_here
```

## 🎯 Features

- ✅ **Serverless Functions**: OAuth authentication & playlist fetching
- ✅ **Beautiful UI**: Gradient background with romantic theme
- ✅ **CORS Enabled**: Ready for frontend-backend communication
- ✅ **Error Handling**: Comprehensive error messages and status codes
- ✅ **Caching**: Token caching for optimal performance
- ✅ **Responsive Design**: Works on desktop and mobile

## 🛠 Technical Details

### Frontend
- Pure HTML, CSS, JavaScript
- Fetches data from `/.netlify/functions/get-playlist`
- Responsive design with gradient backgrounds
- Real-time error handling and loading states

### Backend (Netlify Functions)
- **auth-tidal.js**: Handles OAuth2 client credentials flow
- **get-playlist.js**: Fetches all tracks from TIDAL playlist
- Built-in token caching and error handling
- CORS-enabled for frontend communication

### API Endpoints
- `GET /.netlify/functions/get-playlist` - Returns formatted track list
- `GET /.netlify/functions/auth-tidal` - Returns access token (debug)

## 🎵 Current Status

✅ **Server Infrastructure**: Fully operational  
✅ **Functions**: Auth & playlist fetching work correctly  
✅ **Frontend**: Beautiful interface with test buttons  
⚠️ **TIDAL API Access**: Limited by API tier (needs commercial access)

## 🔄 Known Issues & Solutions

### TIDAL API Limitation
**Issue**: "Client does not have required access tier" (Error 401/6004)  
**Solution**: Upgrade TIDAL API credentials to commercial tier

### Development Testing
The functions can be tested directly:
```bash
node netlify/functions/auth-tidal.js      # Test authentication
node netlify/functions/get-playlist.js    # Test playlist fetching
```

## 📝 For OpenAI Codex Development

### Immediate Tasks You Can Work On:
1. **Mock Data Implementation**: Add sample playlist data for demo mode
2. **UI Enhancements**: Improve design, add animations, search functionality
3. **Error UX**: Better error messages and fallback content
4. **Music Player**: Add basic audio player functionality
5. **Time-based Classification**: Enhance morning/evening song categorization

### Project Dependencies
All required packages are already installed:
- `node-fetch`: HTTP requests to TIDAL API
- `dotenv`: Environment variable management

### Testing Commands
```bash
npm run dev          # Start Netlify dev server
curl localhost:8888  # Test main site
curl localhost:8888/.netlify/functions/get-playlist  # Test API
```

## 🎨 Design Inspiration

The app features a romantic theme with:
- Purple gradient backgrounds
- Soft transitions and borders
- Heart emojis and romantic typography
- Glassmorphism card designs

Perfect for showcasing a curated collection of romantic music!

---

**Ready for OpenAI Codex**: This codebase is clean, documented, and fully functional. The serverless architecture makes it easy to understand and extend.
