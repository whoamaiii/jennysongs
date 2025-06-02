const express = require('express');
const router = express.Router();

// Import the Tidal client
const { tidalClient } = require('../netlify/functions/tidal');

const TIDAL_API_BASE_URL = 'https://openapi.tidal.com/v2';

// Function to classify time of day based on track (placeholder)
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

// Get playlist endpoint
router.get('/playlist', async (req, res) => {
  try {
    // Extract tokens from cookies
    const userToken = req.cookies.tidalUser;
    const refreshToken = req.cookies.tidalRefresh;
    
    if (!userToken) {
      return res.status(302).redirect('/login.html');
    }

    // Set tokens in the client for this request
    tidalClient.setTokensFromCookies(userToken, refreshToken, 3600);
    
    // Get user's country code
    const countryCode = await getUserCountryCode(userToken);

    // Get playlist ID from query parameters or environment
    const playlistId = req.query.id || process.env.TIDAL_PLAYLIST_ID;

    if (!playlistId) {
      console.error('Missing playlist ID in query parameters or environment variables');
      return res.status(400).json({ error: 'Missing playlist ID' });
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

    res.json(formattedTracks);

  } catch (error) {
    console.error('Error in get-playlist function:', error);
    
    // Handle authentication errors
    if (error.message?.includes('please log in again')) {
      return res.status(401).json({ 
        error: 'Authentication required', 
        redirectTo: '/login.html' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch playlist',
      message: error.message 
    });
  }
});

module.exports = router; 