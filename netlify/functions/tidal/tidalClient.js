const fetch = require('node-fetch');

class TidalApiClient {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.baseUrl = 'https://openapi.tidal.com';
    this.authUrl = 'https://auth.tidal.com/v1/oauth2';
    
    // Token management
    this.accessToken = null;
    this.refreshToken = null;
    this.expiryMs = null;
  }

  // Generate OAuth authorization URL
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: 'r_usr',
      state: state || 'state'
    });
    
    return `${this.authUrl}/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code) {
    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.setTokens(data.access_token, data.refresh_token, data.expires_in);
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.authUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    this.setTokens(data.access_token, data.refresh_token || this.refreshToken, data.expires_in);
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.refreshToken,
      expiresIn: data.expires_in
    };
  }

  // Set tokens internally
  setTokens(accessToken, refreshToken, expiresIn) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiryMs = Date.now() + (expiresIn * 1000);
  }

  // Check if token needs refresh (300s buffer)
  needsRefresh() {
    if (!this.expiryMs) return true;
    return Date.now() > (this.expiryMs - 300000); // 5 minute buffer
  }

  // Get current user
  async getCurrentUser(countryCode = 'US') {
    const response = await this.makeAuthenticatedRequest('/v2/user', { countryCode });
    return response;
  }

  // Get playlist
  async getPlaylist(playlistId, countryCode = 'US') {
    const response = await this.makeAuthenticatedRequest(`/v2/playlists/${playlistId}`, { 
      countryCode,
      include: 'items'
    });
    return response;
  }

  // Make authenticated request with auto-refresh
  async makeAuthenticatedRequest(path, queryParams = {}) {
    // Check if we need to refresh
    if (this.needsRefresh() && this.refreshToken) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/vnd.tidal.v1+json',
        'X-Tidal-Token': this.clientId
      }
    });

    if (response.status === 401 && this.refreshToken) {
      // Token expired, try refreshing once
      await this.refreshAccessToken();
      
      // Retry request
      const retryResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/vnd.tidal.v1+json',
          'X-Tidal-Token': this.clientId
        }
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.text();
        throw new Error(`API request failed: ${retryResponse.status} - ${error}`);
      }

      return await retryResponse.json();
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  // 🧪 Helper for tests – never used in prod
  setTokensForTesting(access, refresh, ttlSeconds) {
    this.accessToken = access;
    this.refreshToken = refresh;
    this.expiryMs = Date.now() + ttlSeconds * 1000;
  }
}

module.exports = { TidalApiClient };