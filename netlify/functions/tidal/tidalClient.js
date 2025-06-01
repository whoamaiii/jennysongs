const axios = require('axios');

const TIDAL_API_BASE_URL = 'https://openapi.tidal.com';
const TIDAL_AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2';

class TidalApiClient {
  constructor(clientId = process.env.TIDAL_CLIENT_ID, clientSecret = process.env.TIDAL_CLIENT_SECRET, redirectUri = process.env.TIDAL_REDIRECT_URI) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  getAuthUrl(state, codeChallenge) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'r_usr+w_usr',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    return `${TIDAL_AUTH_BASE_URL}/auth?${params}`;
  }

  async exchangeCodeForTokens(code, codeVerifier) {
    const tokenData = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier
    };

    try {
      const response = await this._tokenRequestWithRetry('POST', `${TIDAL_AUTH_BASE_URL}/token`, tokenData);

      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenExpiry = new Date(Date.now() + expires_in * 1000);

      console.log('Tokens successfully obtained and stored.');
      return response.data;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async refreshTokens() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenData = {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
    };

    try {
      const response = await this._tokenRequestWithRetry('POST', `${TIDAL_AUTH_BASE_URL}/token`, tokenData);

      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      if (refresh_token) {
        this.refreshToken = refresh_token;
      }
      this.tokenExpiry = new Date(Date.now() + expires_in * 1000);

      console.log('Tokens refreshed successfully.');
      return response.data;
    } catch (error) {
      console.error('Error refreshing tokens:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  async ensureValidToken() {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }

    // Check if token will expire in the next 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (this.tokenExpiry && this.tokenExpiry < fiveMinutesFromNow) {
      console.log('Token expiring soon. Refreshing...');
      await this.refreshTokens();
    }
  }

  async request(method, url, options = {}) {
    await this.ensureValidToken();

    const { params, data, headers: customHeaders, maxRetries = 3, ...restOfOptions } = options;
    const fullUrl = url.startsWith('http') ? url : `${TIDAL_API_BASE_URL}${url}`;

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    
    // Add countryCode to params if not already present, for GET requests
    let effectiveParams = params;
    if (method.toLowerCase() === 'get' && params && params.countryCode === undefined) {
        // console.warn("Warning: 'countryCode' parameter is typically required for TIDAL API requests. Attempting without it or with a default if available.");
        // Consider adding a default or throwing an error if countryCode is strictly necessary for most calls.
    }

    return this._requestWithRetry(method, fullUrl, effectiveParams, data, headers, restOfOptions, maxRetries);
  }

  async _requestWithRetry(method, fullUrl, params, data, headers, restOfOptions, maxRetries, attempt = 1) {
    try {
      const response = await axios({
        method,
        url: fullUrl,
        params,
        data,
        headers,
        timeout: 30000, // 30 second timeout
        ...restOfOptions,
      });
      return response;
    } catch (error) {
      // Handle 401 Unauthorized - token refresh
      if (error.response && error.response.status === 401) {
        const errorData = error.response.data || {};
        // TIDAL specific subStatus for expired token might be 6004 or similar
        if (errorData.subStatus === 6004 || (errorData.userMessage && errorData.userMessage.toLowerCase().includes('token expired'))) {
          console.log('Access token expired (401 received). Attempting reactive refresh...');
          try {
            await this.refreshTokens();
            // Retry the original request with the new token
            headers['Authorization'] = `Bearer ${this.accessToken}`;
            console.log('Retrying original request with new token...');
            return await this._requestWithRetry(method, fullUrl, params, data, headers, restOfOptions, maxRetries, attempt);
          } catch (refreshError) {
            console.error('Failed to refresh token or retry request after 401:', refreshError);
            throw refreshError;
          }
        }
      }

      // Handle 429 Rate Limiting
      if (error.response && error.response.status === 429) {
        if (attempt <= maxRetries) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this._calculateBackoffDelay(attempt);
          console.log(`Rate limited (429). Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await this._sleep(delay);
          return this._requestWithRetry(method, fullUrl, params, data, headers, restOfOptions, maxRetries, attempt + 1);
        } else {
          throw new Error(`Rate limit exceeded. Max retries (${maxRetries}) reached.`);
        }
      }

      // Handle network errors and timeouts
      const isRetriableError = this._isRetriableError(error);
      if (isRetriableError && attempt <= maxRetries) {
        const delay = this._calculateBackoffDelay(attempt);
        console.log(`Retriable error encountered. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, error.message);
        await this._sleep(delay);
        return this._requestWithRetry(method, fullUrl, params, data, headers, restOfOptions, maxRetries, attempt + 1);
      }

      // Handle other errors (e.g., bad requests)
      console.error(`API request to ${method.toUpperCase()} ${fullUrl} failed:`, error.response ? error.response.data : error.message);
      if (error.response && error.response.data && error.response.data.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  _isRetriableError(error) {
    // Network errors, timeouts, and 5xx server errors are retriable
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    if (error.response && error.response.status >= 500) {
      return true;
    }
    return false;
  }

  _calculateBackoffDelay(attempt) {
    // Exponential backoff with jitter: base delay * 2^attempt + random jitter
    const baseDelay = 1000; // 1 second
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _tokenRequestWithRetry(method, url, data, maxRetries = 3, attempt = 1) {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      const response = await axios({
        method,
        url,
        data: new URLSearchParams(data).toString(),
        headers,
        timeout: 30000, // 30 second timeout
      });
      return response;
    } catch (error) {
      // Handle 429 Rate Limiting
      if (error.response && error.response.status === 429) {
        if (attempt <= maxRetries) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : this._calculateBackoffDelay(attempt);
          console.log(`Token request rate limited (429). Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await this._sleep(delay);
          return this._tokenRequestWithRetry(method, url, data, maxRetries, attempt + 1);
        } else {
          throw new Error(`Token request rate limit exceeded. Max retries (${maxRetries}) reached.`);
        }
      }

      // Handle network errors and timeouts
      const isRetriableError = this._isRetriableError(error);
      if (isRetriableError && attempt <= maxRetries) {
        const delay = this._calculateBackoffDelay(attempt);
        console.log(`Retriable error in token request. Retrying in ${delay}ms (attempt ${attempt}/${maxRetries}):`, error.message);
        await this._sleep(delay);
        return this._tokenRequestWithRetry(method, url, data, maxRetries, attempt + 1);
      }

      // For token requests, we don't retry on 401 (that would be circular)
      // Just throw the error
      throw error;
    }
  }

  // User-related methods
  async getCurrentUser() {
    return this.request('GET', '/v2/users/me', {
      params: { countryCode: 'NO' }
    });
  }

  async getUserPlaylists(userId, limit = 50, offset = 0) {
    return this.request('GET', `/v2/users/${userId}/playlists`, {
      params: { 
        countryCode: 'NO',
        limit,
        offset
      }
    });
  }

  // Playlist-related methods
  async getPlaylist(playlistUuid) {
    return this.request('GET', `/v2/playlists/${playlistUuid}`, {
      params: { countryCode: 'NO' }
    });
  }

  async getPlaylistTracks(playlistUuid, limit = 50, offset = 0) {
    return this.request('GET', `/v2/playlists/${playlistUuid}/items`, {
      params: { 
        countryCode: 'NO',
        limit,
        offset
      }
    });
  }

  async createPlaylist(title, description = '') {
    return this.request('POST', '/v2/playlists', {
      data: {
        title,
        description
      }
    });
  }

  async addTracksToPlaylist(playlistUuid, trackIds) {
    return this.request('POST', `/v2/playlists/${playlistUuid}/items`, {
      data: {
        trackIds
      }
    });
  }

  // Track-related methods
  async getTrack(trackId) {
    return this.request('GET', `/v2/tracks/${trackId}`, {
      params: { countryCode: 'NO' }
    });
  }

  async searchTracks(query, limit = 10) {
    return this.request('GET', '/v2/searchresults/tracks', {
      params: { 
        query,
        countryCode: 'NO',
        limit
      }
    });
  }

  // Favorites-related methods
  async getFavoriteTracks(userId, limit = 50, offset = 0) {
    return this.request('GET', `/v2/users/${userId}/favorites/tracks`, {
      params: { 
        countryCode: 'NO',
        limit,
        offset
      }
    });
  }

  async addTrackToFavorites(trackId) {
    return this.request('POST', '/v2/users/me/favorites/tracks', {
      data: {
        trackId
      }
    });
  }

  async removeTrackFromFavorites(trackId) {
    return this.request('DELETE', `/v2/users/me/favorites/tracks/${trackId}`);
  }

  // Testing utility methods - allows tests to set and get token states for mocking
  setTokensForTesting(accessToken, refreshToken, tokenExpiry) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = tokenExpiry;
  }

  getAccessToken() {
    return this.accessToken;
  }
}

module.exports = { TidalApiClient };
