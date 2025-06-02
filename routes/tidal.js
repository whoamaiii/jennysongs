const express = require('express');
const router = express.Router();

// Import the Tidal client
const { tidalClient } = require('../netlify/functions/tidal');

// Test endpoint for Tidal configuration
router.get('/test', async (req, res) => {
  try {
    const userToken = req.cookies.tidalUser;
    
    if (!userToken) {
      return res.json({
        authenticated: false,
        message: 'No authentication token found',
        configuration: {
          clientId: process.env.TIDAL_CLIENT_ID ? 'Set' : 'Missing',
          clientSecret: process.env.TIDAL_CLIENT_SECRET ? 'Set' : 'Missing',
          playlistId: process.env.TIDAL_PLAYLIST_ID ? 'Set' : 'Missing',
          redirectUri: process.env.TIDAL_REDIRECT_URI || 'Default'
        }
      });
    }

    // Set token and try a basic API call
    tidalClient.setTokensFromCookies(userToken, null, 3600);
    
    try {
      const response = await tidalClient.request('get', 'https://openapi.tidal.com/v2/user');
      res.json({
        authenticated: true,
        message: 'TIDAL API connection successful',
        user: {
          id: response.data?.id || 'Unknown',
          countryCode: response.data?.countryCode || 'Unknown'
        }
      });
    } catch (apiError) {
      res.json({
        authenticated: false,
        message: 'Token exists but API call failed',
        error: apiError.message
      });
    }
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message 
    });
  }
});

module.exports = router; 