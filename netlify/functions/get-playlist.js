const fetch = require('node-fetch');
const { getAccessToken } = require('./auth-tidal');
require('dotenv').config();

const TIDAL_API_BASE_URL = 'https://api.tidal.com/v1';

// Function to classify time of day based on track (placeholder)
// You might want to refine this logic based on actual track data or external libraries
function classifyTimeOfDay(trackTitle) {
  const lowerTitle = trackTitle.toLowerCase();
  if (lowerTitle.includes('morning') || lowerTitle.includes('sunrise') || lowerTitle.includes('dawn')) {
    return 'morning';
  }
  if (lowerTitle.includes('evening') || lowerTitle.includes('sunset') || lowerTitle.includes('dusk') || lowerTitle.includes('night')) {
    return 'evening';
  }
  return 'day'; // Default classification
}

async function fetchAllPlaylistTracks(playlistId, accessToken) {
  let tracks = [];
  let offset = 0;
  const limit = 100; // TIDAL API limit per request
  let keepFetching = true;

  while (keepFetching) {
    const url = `${TIDAL_API_BASE_URL}/playlists/${playlistId}/tracks?countryCode=US&limit=${limit}&offset=${offset}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.tidal.v1+json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching playlist tracks from TIDAL:', response.status, errorData);
        throw new Error(`TIDAL API Error: ${response.status} - ${errorData.userMessage || errorData.message || 'Failed to fetch playlist tracks'}`);
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        tracks = tracks.concat(data.items);
        offset += data.items.length;
        if (data.items.length < limit || tracks.length >= data.totalNumberOfItems) {
          keepFetching = false; // Stop if last page or all items fetched
        }
      } else {
        keepFetching = false; // No more items
      }
    } catch (error) {
      console.error('Error during fetchAllPlaylistTracks:', error);
      throw error; // Re-throw to be handled by the main handler
    }
  }
  return tracks;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*', // Or your specific frontend domain for better security
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
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
    const accessToken = await getAccessToken();
    const playlistId = process.env.TIDAL_PLAYLIST_ID;

    if (!playlistId) {
      console.error('Missing TIDAL_PLAYLIST_ID in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error: Missing Playlist ID' })
      };
    }

    const rawTracks = await fetchAllPlaylistTracks(playlistId, accessToken);

    const formattedTracks = rawTracks.map(item => {
      if (!item.item || item.type !== 'track') return null; // Skip non-track items or items without track data
      const track = item.item;
      return {
        id: track.id,
        title: track.title,
        artist: track.artists && track.artists.length > 0 ? track.artists.map(a => a.name).join(', ') : 'Unknown Artist',
        album: track.album ? track.album.title : 'Unknown Album',
        duration: track.duration,
        coverArtUrl: track.album && track.album.cover ? `${TIDAL_API_BASE_URL}/albums/${track.album.id}/images/320x320.jpg` : null, // Construct image URL
        streamUrl: `${TIDAL_API_BASE_URL}/tracks/${track.id}/streamUrl?soundQuality=HIGH`, // Example, may need token
        timeOfDay: classifyTimeOfDay(track.title) // Basic classification
      };
    }).filter(track => track !== null); // Remove any null entries from malformed items

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedTracks)
    };

  } catch (error) {
    console.error('Error in get-playlist function:', error);
    return {
      statusCode: error.message && error.message.includes('TIDAL API Error') ? 502 : 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Failed to fetch playlist from TIDAL' })
    };
  }
};

// For local testing/direct invocation if needed
if (require.main === module) {
  (async () => {
    try {
      console.log('Attempting to fetch playlist...');
      // Mock event and context for local run
      const result = await exports.handler({}, {});
      console.log('Status Code:', result.statusCode);
      const body = JSON.parse(result.body);
      if (result.statusCode === 200) {
        console.log(`Fetched ${body.length} tracks.`);
        // console.log('First 3 tracks:', body.slice(0, 3));
      } else {
        console.error('Error body:', body);
      }
    } catch (e) {
      console.error('Error in test execution of get-playlist:', e);
    }
  })();
} 