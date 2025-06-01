require('dotenv').config();

exports.handler = async (_event, _context) => {
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
    const params = new URLSearchParams({
      client_id: process.env.TIDAL_CLIENT_ID,
      response_type: 'code',
      redirect_uri: process.env.TIDAL_REDIRECT_URI,
      scope: process.env.TIDAL_SCOPES || 'playlists.read',
    });

    const authUrl = `https://auth.tidal.com/v1/oauth2/authorize?${params}`;

    return {
      statusCode: 302,
      headers: { 
        ...headers,
        Location: authUrl 
      }
    };
  } catch (error) {
    console.error('Error in tidal-login:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to initiate TIDAL login' })
    };
  }
}; 