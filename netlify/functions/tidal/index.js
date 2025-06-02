// netlify/functions/tidal/index.js
const { TidalApiClient } = require('./tidalClient');

// Create an instance with environment variables
const tidalClient = new TidalApiClient();

// Add the missing setTokensFromCookies method
tidalClient.setTokensFromCookies = function(accessToken, refreshToken, expiresIn) {
  this.accessToken = accessToken;
  this.refreshToken = refreshToken;
  if (expiresIn) {
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
  }
};

// Add other missing methods that the existing code expects
tidalClient.needsRefresh = function() {
  if (!this.accessToken) return true;
  if (!this.tokenExpiry) return false;
  
  // Check if token expires in the next 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  return this.tokenExpiry < fiveMinutesFromNow;
};

tidalClient.setTokens = function(tokenData) {
  if (tokenData.access_token) {
    this.accessToken = tokenData.access_token;
  }
  if (tokenData.refresh_token) {
    this.refreshToken = tokenData.refresh_token;
  }
  if (tokenData.expires_in) {
    this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
  }
};

module.exports = { 
  TidalApiClient,
  tidalClient 
};
