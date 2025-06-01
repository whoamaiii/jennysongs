// const fetch = require('node-fetch');
// const axios = require('axios'); // Currently unused but kept for potential future use
// const { getAccessToken } = require('./auth-tidal');
const { tidalClient } = require('./tidal');
require('dotenv').config();

const TIDAL_API_BASE_URL = 'https://openapi.tidal.com/v2';

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

async function fetchAllPlaylistTracks(playlistId, userToken, countryCode = 'US') {
  let tracks = [];
  let offset = 0;
  const limit = 100; // TIDAL API limit per request
  let keepFetching = true;

  // Set tokens for the client (server-side usage)
  if (userToken) {
    tidalClient.setTokensFromCookies(userToken, null, 3600); // Default 1 hour
  }

  while (keepFetching) {
    const url = `${TIDAL_API_BASE_URL}/playlists/${playlistId}/items?countryCode=${countryCode}&limit=${limit}&offset=${offset}`;
    try {
      const response = await tidalClient.request('get', url);

      const data = response.data;
      if (data.data && data.data.length > 0) {
        tracks = tracks.concat(data.data);
        offset += data.data.length;
        if (data.data.length < limit || !data.metadata?.next) {
          keepFetching = false; // Stop if last page or no next page
        }
      } else {
        keepFetching = false; // No more items
      }
    } catch (error) {
      console.error('Error during fetchAllPlaylistTracks:', error);
      if (error.message?.includes('please log in again')) {
        throw error;
      }
      throw new Error('Failed to fetch playlist tracks');
    }
  }
  return tracks;
}

// Helper function to extract token from cookies
function extractUserToken(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/tidalUser=([^;]+)/);
  return match ? match[1] : null;
}

// Helper function to extract refresh token from cookies
function extractRefreshToken(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/tidalRefresh=([^;]+)/);
  return match ? match[1] : null;
}

// Helper function to get user's country code
async function getUserCountryCode(_userToken) {
  try {
    // Try to get user profile for country code
    const response = await tidalClient.request('get', 'https://openapi.tidal.com/v2/user');
    if (response.data?.countryCode) {
      return response.data.countryCode;
    }
  } catch (error) {
    console.warn('Could not fetch user country code:', error.message);
  }
  
  // Fallback chain
  return process.env.TIDAL_COUNTRY_CODE || process.env.DEFAULT_COUNTRY || 'US';
}

// Helper function to refresh access token (currently unused but kept for future use)
/*
async function refreshAccessToken(refreshToken) {
  try {
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
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

    return response.data;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
}
*/

exports.handler = async (_event, _context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*', // Or your specific frontend domain for better security
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (_event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    // Extract tokens from cookies
    const userToken = extractUserToken(_event.headers.cookie);
    const refreshToken = extractRefreshToken(_event.headers.cookie);
    
    if (!userToken) {
      return { 
        statusCode: 302, 
        headers: { 
          ...headers,
          Location: '/login.html' 
        } 
      };
    }

    // Set tokens in the client for this request
    tidalClient.setTokensFromCookies(userToken, refreshToken, 3600);
    
    // Get user's country code
    const countryCode = await getUserCountryCode(userToken);

    // Get playlist ID from query parameters or environment
    const playlistId = _event.queryStringParameters?.id || process.env.TIDAL_PLAYLIST_ID;

    if (!playlistId) {
      console.error('Missing playlist ID in query parameters or environment variables');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing playlist ID' })
      };
    }

    const rawTracks = await fetchAllPlaylistTracks(playlistId, userToken, countryCode);

    const formattedTracks = rawTracks.map(item => {
      if (!item.resource || item.type !== 'track') return null; // Skip non-track items or items without track data
      const track = item.resource;
      return {
        id: track.id,
        title: track.title,
        artist: track.artists && track.artists.length > 0 ? track.artists.map(a => a.name).join(', ') : 'Unknown Artist',
        album: track.album ? track.album.title : 'Unknown Album',
        duration: track.duration,
        coverArtUrl: track.album && track.album.imageCover ? track.album.imageCover.find(img => img.width === 320)?.url || track.album.imageCover[0]?.url : null,
        previewUrl: track.mediaMetadata?.previews?.length > 0 ? track.mediaMetadata.previews[0].url : null,
        tidalUrl: `https://tidal.com/browse/track/${track.id}`,
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
    
    // Handle authentication errors
    if (error.message?.includes('please log in again')) {
      return {
        statusCode: 302,
        headers: {
          ...headers,
          Location: '/login.html'
        }
      };
    }
    
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Failed to fetch playlist from TIDAL',
        requiresAuth: error.message?.includes('authentication') || error.message?.includes('log in')
      })
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