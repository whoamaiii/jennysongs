const { TidalApiClient } = require('./tidal');

exports.handler = async (_event, _context) => {
  try {
    const client = new TidalApiClient(
      process.env.TIDAL_CLIENT_ID,
      process.env.TIDAL_CLIENT_SECRET,
      process.env.TIDAL_REDIRECT_URI || `${process.env.URL}/.netlify/functions/tidal-callback`
    );

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    // Get authorization URL
    const authUrl = client.getAuthorizationUrl(state);

    return {
      statusCode: 302,
      headers: {
        'Location': authUrl,
        'Set-Cookie': `tidalState=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`
      },
      body: ''
    };
  } catch (error) {
    console.error('Login error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Login initialization failed',
        message: error.message
      })
    };
  }
};