const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper function to get OAuth URL (from tidal-login.js)
router.get('/login', (req, res) => {
  try {
    const clientId = process.env.TIDAL_CLIENT_ID;
    const redirectUri = process.env.TIDAL_REDIRECT_URI || 'http://localhost:8888/api/auth/callback';
    
    if (!clientId) {
      return res.status(400).json({ error: 'TIDAL_CLIENT_ID not configured' });
    }

    const authUrl = new URL('https://auth.tidal.com/v1/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'r_usr+r_usr_playback_status+r_usr_collection+r_usr_playlist+r_usr_email+r_usr_profile+r_usr_devices+r_usr_listening_activity+r_usr_created_playlists+r_usr_saved_playlists');

    console.log('Redirecting to TIDAL OAuth:', authUrl.toString());
    res.redirect(authUrl.toString());
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

// OAuth callback handler (from tidal-callback.js)
router.get('/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      console.error('OAuth error:', error);
      return res.redirect('/login.html?error=' + encodeURIComponent(error));
    }

    if (!code) {
      return res.redirect('/login.html?error=missing_code');
    }

    // Exchange code for tokens
    const data = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.TIDAL_REDIRECT_URI || 'http://localhost:8888/api/auth/callback'
    });

    const auth = Buffer
      .from(`${process.env.TIDAL_CLIENT_ID}:${process.env.TIDAL_CLIENT_SECRET}`)
      .toString('base64');

    const response = await axios.post(
      'https://auth.tidal.com/v1/oauth2/token',
      data,
      { 
        headers: { 
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        } 
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = Date.now() + (expires_in * 1000);
    
    // Set secure cookies
    res.cookie('tidalUser', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expires_in * 1000
    });

    if (refresh_token) {
      res.cookie('tidalRefresh', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expires_in * 1000
      });
    }

    res.cookie('tidalExpiry', expiresAt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expires_in * 1000
    });
    
    // Redirect to success page or main app
    res.redirect('/');

  } catch (error) {
    console.error('Token exchange error:', error);
    
    if (error.response) {
      console.error('TIDAL API Error:', error.response.status, error.response.data);
    }
    res.redirect('/login.html?error=' + encodeURIComponent(error.message || 'authentication_failed'));
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('tidalUser');
  res.clearCookie('tidalRefresh');
  res.clearCookie('tidalExpiry');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Check authentication status
router.get('/status', (req, res) => {
  const token = req.cookies.tidalUser;
  const expiry = req.cookies.tidalExpiry;
  
  if (!token) {
    return res.json({ authenticated: false });
  }
  
  if (expiry && Date.now() > parseInt(expiry)) {
    res.clearCookie('tidalUser');
    res.clearCookie('tidalRefresh');
    res.clearCookie('tidalExpiry');
    return res.json({ authenticated: false, reason: 'token_expired' });
  }
  
  res.json({ authenticated: true });
});

module.exports = router; 