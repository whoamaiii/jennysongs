// Test script for TIDAL client token refresh
const { tidalClient } = require('./netlify/functions/tidal');

async function testTokenRefresh() {
  console.log('🧪 Testing TIDAL Client Token Refresh...\n');
  
  // Test 1: Check initial state
  console.log('Test 1: Initial State');
  console.log('- Has access token:', !!tidalClient.accessToken);
  console.log('- Has refresh token:', !!tidalClient.refreshToken);
  console.log('- Needs refresh:', tidalClient.needsRefresh());
  
  // Test 2: Test with expired token
  console.log('\nTest 2: Simulating Expired Token');
  tidalClient.accessToken = 'expired-token';
  tidalClient.expiresAt = Date.now() - 1000; // Already expired
  console.log('- Needs refresh:', tidalClient.needsRefresh());
  
  // Test 3: Test API request with 401 response
  console.log('\nTest 3: API Request Handling');
  try {
    // This should fail with 401 and trigger refresh
    await tidalClient.request('get', 'https://openapi.tidal.com/v2/test');
    console.log('- Request succeeded (unexpected)');
  } catch (error) {
    console.log('- Request failed as expected:', error.message);
    console.log('- Should trigger refresh and retry');
  }
  
  // Test 4: Test refresh timer
  console.log('\nTest 4: Refresh Timer');
  const mockTokenData = {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_in: 3600 // 1 hour
  };
  
  tidalClient.setTokens(mockTokenData);
  console.log('- Timer scheduled:', !!tidalClient._refreshTimer);
  console.log('- Expires at:', new Date(tidalClient.expiresAt).toISOString());
  
  // Test 5: Multi-tab sync (browser only)
  console.log('\nTest 5: Storage Sync');
  if (typeof window !== 'undefined') {
    console.log('- Testing browser storage events...');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'tidalAuth',
      newValue: JSON.stringify({
        accessToken: 'new-token-from-other-tab',
        refreshToken: 'new-refresh',
        expiresAt: Date.now() + 7200000
      })
    }));
    console.log('- Token updated from storage:', tidalClient.accessToken === 'new-token-from-other-tab');
  } else {
    console.log('- Skipping browser-only test');
  }
  
  console.log('\n✅ Token refresh wrapper tests complete!');
}

// Run tests if called directly
if (require.main === module) {
  testTokenRefresh().catch(console.error);
}

module.exports = { testTokenRefresh }; 