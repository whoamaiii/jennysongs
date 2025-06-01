const fetch = require('node-fetch');

// Headers for TIDAL API (not used here)

async function getAccessToken() {
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
    const errorText = await authResponse.text();
    console.error('Auth response:', authResponse.status, errorText);
    console.error('Client ID:', process.env.TIDAL_CLIENT_ID ? 'Present' : 'Missing');
    console.error('Client Secret:', process.env.TIDAL_CLIENT_SECRET ? 'Present' : 'Missing');
    throw new Error(`Authentication failed: ${authResponse.status} - ${errorText}`);
  }

  const authData = await authResponse.json();
  return authData.access_token;
}

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

exports.handler = async (event, _context) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const accessToken = await getAccessToken();
    const playlistId = process.env.TIDAL_PLAYLIST_ID;
    
    const playlistResponse = await fetch(`https://openapi.tidal.com/playlists/${playlistId}/items?countryCode=US&limit=100`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.tidal.v1+json',
        'X-Tidal-Token': process.env.TIDAL_CLIENT_ID
      }
    });

    if (!playlistResponse.ok) {
      const errorText = await playlistResponse.text();
      console.error('Playlist fetch error:', playlistResponse.status, errorText);
      throw new Error(`Playlist fetch failed: ${playlistResponse.status} - ${errorText}`);
    }

    const playlistData = await playlistResponse.json();
    console.log('Playlist data structure:', JSON.stringify(playlistData, null, 2));
    
    const formattedTracks = playlistData.data.map(item => {
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        tracks: formattedTracks,
        total: formattedTracks.length,
        source: 'TIDAL API'
      })
    };

  } catch (error) {
    console.error('Playlist fetch error:', error);
    
    const fallbackSongs = [
      {
        id: 'fallback_1',
        title: 'Perfect',
        artist: 'Ed Sheeran',
        album: '÷ (Divide)',
        duration: 263,
        coverUrl: '',
        classification: 'evening',
        source: 'fallback'
      },
      {
        id: 'fallback_2',
        title: 'Thinking Out Loud',
        artist: 'Ed Sheeran',
        album: 'x (Multiply)',
        duration: 281,
        coverUrl: '',
        classification: 'evening',
        source: 'fallback'
      },
      {
        id: 'fallback_3',
        title: 'All of Me',
        artist: 'John Legend',
        album: 'Love in the Future',
        duration: 269,
        coverUrl: '',
        classification: 'evening',
        source: 'fallback'
      }
    ];

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        tracks: fallbackSongs,
        total: fallbackSongs.length,
        source: 'Fallback (TIDAL API unavailable)',
        error: error.message
      })
    };
  }
};