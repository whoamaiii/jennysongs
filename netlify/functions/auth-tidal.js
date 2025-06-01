const fetch = require('node-fetch');
require('dotenv').config();

let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  const clientId = process.env.TIDAL_CLIENT_ID;
  const clientSecret = process.env.TIDAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing TIDAL_CLIENT_ID or TIDAL_CLIENT_SECRET in environment variables');
    throw new Error('Missing TIDAL API credentials');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  try {
    const response = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: params
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching TIDAL token:', response.status, errorData);
      throw new Error(`TIDAL Auth Error: ${response.status} - ${errorData.error_description || errorData.error || 'Unknown error'}`);
    }

    const tokenData = await response.json();
    cachedToken = {
      access_token: tokenData.access_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000) - 60000 // Subtract 1 minute buffer
    };
    return cachedToken.access_token;

  } catch (error) {
    console.error('Failed to get access token:', error);
    throw error; // Re-throw to be caught by the handler
  }
}

exports.handler = async (event, context) => {
  try {
    const token = await getAccessToken();
    return {
      statusCode: 200,
      body: JSON.stringify({ accessToken: token })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Failed to authenticate with TIDAL' })
    };
  }
};

// For local testing/direct invocation if needed
if (require.main === module) {
  (async () => {
    try {
      console.log('Attempting to get token...');
      const token = await getAccessToken();
      console.log('Access Token:', token);
      // Second call to test caching
      console.log('Attempting to get token again (should be cached)...');
      const cached = await getAccessToken();
      console.log('Cached Token:', cached);
    } catch (error) {
      console.error('Error in test execution:', error);
    }
  })();
}

module.exports.getAccessToken = getAccessToken; // Export for get-playlist.js 