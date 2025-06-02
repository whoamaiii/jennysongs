require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Import and use route handlers
const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlist');
const tidalRoutes = require('./routes/tidal');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', playlistRoutes);
app.use('/api/tidal', tidalRoutes);

// Health check endpoint
app.get('/api/ping', (req, res) => {
  res.json({ 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Catch-all route to serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`🎵 Jenny's Romantic Songs server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
  console.log(`⚡ API endpoints available at: http://localhost:${PORT}/api/`);
  
  // Environment check
  console.log('\nEnvironment variables loaded:');
  console.log(`- TIDAL_CLIENT_ID: ${process.env.TIDAL_CLIENT_ID ? '✓' : '✗'}`);
  console.log(`- TIDAL_CLIENT_SECRET: ${process.env.TIDAL_CLIENT_SECRET ? '✓' : '✗'}`);
  console.log(`- TIDAL_PLAYLIST_ID: ${process.env.TIDAL_PLAYLIST_ID ? '✓' : '✗'}`);
  console.log(`- TIDAL_REDIRECT_URI: ${process.env.TIDAL_REDIRECT_URI || 'Not set'}`);
}); 