const { TidalApiClient } = require('./tidal');

// Parse cookies from header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });
  }
  return cookies;
}

exports.handler = async (event, _context) => {
  try {
    const { code, state, error } = event.queryStringParameters || {};
    
    if (error) {
      return {
        statusCode: 302,
        headers: {
          'Location': '/login.html?error=authorization_denied'
        },
        body: ''
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authorization code' })
      };
    }

    // Verify state for CSRF protection
    const cookies = parseCookies(event.headers.cookie);
    const savedState = cookies.tidalState;
    
    if (!savedState || savedState !== state) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid state parameter' })
      };
    }

    const client = new TidalApiClient(
      process.env.TIDAL_CLIENT_ID,
      process.env.TIDAL_CLIENT_SECRET,
      process.env.TIDAL_REDIRECT_URI || `${process.env.URL}/.netlify/functions/tidal-callback`
    );

    // Exchange code for tokens
    const { refreshToken, expiresIn } = await client.exchangeCodeForTokens(code);

    // Get user info
    const user = await client.getCurrentUser();

    // Set secure cookies
    const cookieOptions = 'Path=/; HttpOnly; SameSite=Lax; Secure';
    const accessExpiry = new Date(Date.now() + (expiresIn * 1000)).toUTCString();
    
    return {
      statusCode: 302,
      headers: {
        'Location': '/index.html',
        'Set-Cookie': [
          `tidalUser=${encodeURIComponent(JSON.stringify({
            id: user.id,
            username: user.username,
            countryCode: user.countryCode
          }))}; ${cookieOptions}; Expires=${accessExpiry}`,
          `tidalRefresh=${refreshToken}; ${cookieOptions}; Max-Age=2592000`, // 30 days
          `tidalState=; Path=/; HttpOnly; Max-Age=0` // Clear state cookie
        ].join(', ')
      },
      body: ''
    };
  } catch (error) {
    console.error('Callback error:', error);
    
    return {
      statusCode: 302,
      headers: {
        'Location': '/login.html?error=token_exchange_failed'
      },
      body: ''
    };
  }
};