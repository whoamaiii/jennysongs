const fetch = require('node-fetch');

let cachedToken = null;
let tokenExpiry = null;

// Headers for TIDAL API (not used in client credentials flow)

exports.handler = async (_event, _context) => {
  try {
    const now = Date.now();
    
    if (cachedToken && tokenExpiry && now < tokenExpiry) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
          access_token: cachedToken,
          expires_in: Math.floor((tokenExpiry - now) / 1000)
        })
      };
    }

    const authResponse = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.TIDAL_CLIENT_ID,
        client_secret: process.env.TIDAL_CLIENT_SECRET,
        scope: 'r_usr'
      })
    });

    if (!authResponse.ok) {
      throw new Error(`Authentication failed: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    
    cachedToken = authData.access_token;
    tokenExpiry = now + (authData.expires_in * 1000) - 60000; // 1 minute buffer

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        access_token: cachedToken,
        expires_in: authData.expires_in
      })
    };

  } catch (error) {
    console.error('Auth error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Authentication failed',
        message: error.message
      })
    };
  }
};