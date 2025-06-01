const { TidalApiClient } = require('./tidal');

// Parse cookies from header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

// In-memory refresh promise cache to prevent race conditions
let refreshPromise = null;

exports.handler = async (event, _context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: ''
    };
  }

  try {
    const cookies = parseCookies(event.headers.cookie);
    const refreshToken = cookies.tidalRefresh;
    const userCookie = cookies.tidalUser;

    if (!refreshToken || !userCookie) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Not authenticated' })
      };
    }

    const user = JSON.parse(userCookie);
    const countryCode = user.countryCode || 'US';

    const client = new TidalApiClient(
      process.env.TIDAL_CLIENT_ID,
      process.env.TIDAL_CLIENT_SECRET,
      process.env.TIDAL_REDIRECT_URI || `${process.env.URL}/.netlify/functions/tidal-callback`
    );

    // Use the refresh token to get a new access token
    // Guard against multiple concurrent refreshes
    if (!refreshPromise) {
      refreshPromise = client.refreshAccessToken.call(client, refreshToken)
        .finally(() => { refreshPromise = null; });
    }
    
    const { accessToken } = await refreshPromise;
    client.setTokens(accessToken, refreshToken, 3600); // Default 1 hour

    // Get playlist
    const playlistId = event.queryStringParameters?.playlistId || process.env.TIDAL_PLAYLIST_ID;
    const playlist = await client.getPlaylist(playlistId, countryCode);

    // Format tracks for frontend
    const formattedTracks = playlist.data.map(item => {
      const track = item.resource;
      const duration = track.duration || 240;
      
      return {
        id: track.id,
        title: track.title,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        album: track.album?.title || 'Unknown Album',
        duration: duration,
        coverUrl: track.album?.imageCover?.[0]?.url || '',
        classification: classifySong(track.title, track.artists?.[0]?.name || '', duration),
        source: 'tidal'
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        tracks: formattedTracks,
        total: formattedTracks.length,
        source: 'TIDAL API (OAuth)'
      })
    };

  } catch (error) {
    console.error('Playlist fetch error:', error);
    
    // If it's an auth error, return 401
    if (error.message.includes('401') || error.message.includes('authentication')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication failed', message: error.message })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch playlist',
        message: error.message
      })
    };
  }
};

// Helper function to classify songs
function classifySong(title, artist, duration) {
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  
  const morningKeywords = ['morning', 'sunrise', 'wake', 'coffee', 'bright', 'day', 'start'];
  const eveningKeywords = ['night', 'evening', 'sunset', 'moon', 'sleep', 'dream', 'dark', 'midnight'];
  
  const isMorning = morningKeywords.some(keyword => 
    titleLower.includes(keyword) || artistLower.includes(keyword)
  );
  
  const isEvening = eveningKeywords.some(keyword => 
    titleLower.includes(keyword) || artistLower.includes(keyword)
  );
  
  if (duration < 180) return 'morning';
  if (duration > 300) return 'evening';
  if (isMorning) return 'morning';
  if (isEvening) return 'evening';
  
  return Math.random() > 0.5 ? 'morning' : 'evening';
}