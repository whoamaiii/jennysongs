const axios = require('axios');
require('dotenv').config();

exports.handler = async (event, _context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    const { code } = event.queryStringParameters || {};
    
    if (!code) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ error: 'Missing authorization code' })
      };
    }

    const data = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.TIDAL_REDIRECT_URI,
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

    // Store expires_in for token refresh logic
    const expiresAt = Date.now() + (expires_in * 1000);
    
    const accessTokenCookie = `tidalUser=${access_token}; Max-Age=${expires_in}; HttpOnly; Secure; SameSite=Lax; Path=/`;
    const refreshTokenCookie = `tidalRefresh=${refresh_token}; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax; Path=/`; // 30 days
    const expiryInfoCookie = `tidalExpiry=${expiresAt}; Max-Age=${expires_in}; HttpOnly; Secure; SameSite=Lax; Path=/`;

    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Set-Cookie': [accessTokenCookie, refreshTokenCookie, expiryInfoCookie],
        Location: '/success.html'   // Redirect back to your front-end success page
      }
    };

  } catch (error) {
    console.error('Error in tidal-callback:', error);
    
    // Handle specific TIDAL API errors
    if (error.response) {
      console.error('TIDAL API Error:', error.response.status, error.response.data);
      return {
        statusCode: error.response.status,
        headers,
        body: JSON.stringify({ 
          error: 'TIDAL authentication failed',
          details: error.response.data 
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to complete TIDAL authentication' })
    };
  }
}; 