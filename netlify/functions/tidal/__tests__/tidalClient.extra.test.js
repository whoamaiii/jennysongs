/* eslint-env jest */
const nock = require('nock');
nock.disableNetConnect();

const { TidalApiClient } = require('..');
const { advanceTo, clear } = require('jest-date-mock');

// Mock environment variables
process.env.TIDAL_CLIENT_ID = 'test-client-id';
process.env.TIDAL_CLIENT_SECRET = 'test-client-secret';
process.env.TIDAL_REDIRECT_URI = 'http://localhost:8888/.netlify/functions/tidal-callback';
process.env.TIDAL_SCOPES = 'r_usr+w_usr+w_sub';

let tidalClientInstance;

/**
 * Helper function to create persistent token refresh scope
 * @param {object} payload - Token response payload
 * @param {number} times - Number of times to match (default: Infinity)
 * @returns {nock.Scope} Configured nock scope
 */
function createTokenScope(payload = {}, times = Infinity) {
  const defaultPayload = {
    access_token: 'NEW_TOKEN',
    refresh_token: 'REFRESH',
    expires_in: 3600,
    ...payload
  };

  const interceptor = nock('https://auth.tidal.com')
    .post('/v1/oauth2/token', 'grant_type=refresh_token&refresh_token=REFRESH&client_id=test-client-id')
    .matchHeader('Content-Type', 'application/x-www-form-urlencoded');

  if (times === Infinity) {
    return interceptor.reply(200, defaultPayload).persist();
  } else {
    return interceptor.times(times).reply(200, defaultPayload);
  }
}

beforeEach(() => {
  tidalClientInstance = new TidalApiClient();
});

afterEach(() => {
  nock.cleanAll();
  clear();
  tidalClientInstance.clearTokens && tidalClientInstance.clearTokens();
});

describe('TidalApiClient – Extended Edge Cases', () => {
  // UT-01: Token refresh after 429 + Retry-After
  test('UT-01: token refresh after 429 + Retry-After', async () => {
    tidalClientInstance.setTokensForTesting('STALE', 'REFRESH', 3600);

    // First request gets 429 with Retry-After header
    nock('https://openapi.tidal.com')
      .get('/v2/albums/123')
      .query({ countryCode: 'NO' })
      .reply(429, {
        error: 'rate_limited',
        userMessage: 'Rate limit exceeded'
      }, {
        'Retry-After': '2' // 2 seconds
      });

    // Mock token refresh
    const tokenScope = createTokenScope({
      access_token: 'RETRY_AFTER_TOKEN',
      refresh_token: 'REFRESH',
      expires_in: 3600
    }, 1);

    // Second request succeeds after waiting
    nock('https://openapi.tidal.com')
      .get('/v2/albums/123')
      .query({ countryCode: 'NO' })
      .reply(200, { id: 123, title: 'Rate Limited Album' });

    const startTime = Date.now();
    
    // Client should wait retryAfter duration then succeed
    const res = await tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/123', { 
      params: { countryCode: 'NO' } 
    });
    
    const elapsed = Date.now() - startTime;
    
    expect(res.data.id).toBe(123);
    expect(tidalClientInstance.getAccessToken()).toBe('RETRY_AFTER_TOKEN');
    expect(elapsed).toBeGreaterThanOrEqual(2000); // Should have waited at least 2 seconds
    expect(tokenScope.isDone()).toBe(true);
  }, 10000); // Extended timeout for delay test

  // UT-02: Clock-skew (token exp in 2m30s) - proactive refresh still fires once
  test('UT-02: clock-skew proactive refresh with 2m30s remaining', async () => {
    // Set time so token expires in exactly 2 minutes 30 seconds (150 seconds)
    advanceTo(new Date(2025, 0, 1, 12, 0, 0));
    tidalClientInstance.setTokensForTesting('CLOCK_SKEW_TOKEN', 'REFRESH', 150); // 2m30s remaining

    // Mock proactive token refresh (should trigger since < 5 minutes remaining)
    const tokenScope = createTokenScope({
      access_token: 'CLOCK_SKEW_REFRESHED',
      refresh_token: 'REFRESH',
      expires_in: 3600
    }, 1);

    // Mock successful API request
    nock('https://openapi.tidal.com')
      .get('/v2/playlists/456')
      .query({ countryCode: 'NO' })
      .reply(200, { id: 456, title: 'Clock Skew Playlist' });

    const res = await tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/playlists/456', { 
      params: { countryCode: 'NO' } 
    });

    expect(res.data.id).toBe(456);
    expect(tidalClientInstance.getAccessToken()).toBe('CLOCK_SKEW_REFRESHED');
    expect(tokenScope.isDone()).toBe(true); // Proactive refresh should have fired once
  });

  // UT-03: Network timeout then retry with back-off
  test('UT-03: network timeout then retry with back-off', async () => {
    tidalClientInstance.setTokensForTesting('VALID', 'REFRESH', 7200); // 2 hours - avoid proactive refresh

    // Mock potential token refresh (in case ensureValidToken decides to refresh)
    // eslint-disable-next-line no-unused-vars
    const tokenScope = createTokenScope({}, 0); // Allow 0 calls - only if needed

    // First request times out
    nock('https://openapi.tidal.com')
      .get('/v2/tracks/789')
      .query({ countryCode: 'NO' })
      .replyWithError({ code: 'ETIMEDOUT', message: 'Network timeout' });

    // Second request succeeds after back-off
    nock('https://openapi.tidal.com')
      .get('/v2/tracks/789')
      .query({ countryCode: 'NO' })
      .reply(200, { id: 789, title: 'Timeout Recovery Track' });

    const startTime = Date.now();

    const res = await tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/tracks/789', { 
      params: { countryCode: 'NO' } 
    });

    const elapsed = Date.now() - startTime;

    expect(res.data.id).toBe(789);
    expect(elapsed).toBeGreaterThanOrEqual(100); // Should have waited for retry delay
  }, 10000); // Extended timeout for network delay test

  // Additional edge case: Multiple 429s with varying Retry-After values
  test('handles multiple rate limits with different Retry-After values', async () => {
    tidalClientInstance.setTokensForTesting('VALID', 'REFRESH', 7200); // 2 hours - avoid proactive refresh

    // Mock potential token refresh (in case ensureValidToken decides to refresh)
    // eslint-disable-next-line no-unused-vars
    const tokenScope = createTokenScope({}, 0); // Allow 0 calls - only if needed

    // First 429 with 1-second retry
    nock('https://openapi.tidal.com')
      .get('/v2/search')
      .query({ countryCode: 'NO', query: 'test' })
      .reply(429, { error: 'rate_limited' }, { 'Retry-After': '1' });

    // Second 429 with 3-second retry
    nock('https://openapi.tidal.com')
      .get('/v2/search')
      .query({ countryCode: 'NO', query: 'test' })
      .reply(429, { error: 'rate_limited' }, { 'Retry-After': '3' });

    // Final success
    nock('https://openapi.tidal.com')
      .get('/v2/search')
      .query({ countryCode: 'NO', query: 'test' })
      .reply(200, { items: [{ id: 999, title: 'Multiple Rate Limit Test' }] });

    const startTime = Date.now();
    
    const res = await tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/search', { 
      params: { countryCode: 'NO', query: 'test' } 
    });
    
    const elapsed = Date.now() - startTime;

    expect(res.data.items[0].id).toBe(999);
    expect(elapsed).toBeGreaterThanOrEqual(4000); // Should have waited 1s + 3s minimum
  }, 15000);

  // Edge case: Concurrent requests during rate limiting
  test('handles concurrent requests during rate limiting gracefully', async () => {
    tidalClientInstance.setTokensForTesting('VALID', 'REFRESH', 7200); // 2 hours - avoid proactive refresh

    // Mock potential token refresh (allow it if client decides to, should not affect test logic)
    // eslint-disable-next-line no-unused-vars
    const tokenScope = createTokenScope({}, Infinity); // Persist, allow calls if needed

    // All requests hit rate limit initially
    nock('https://openapi.tidal.com')
      .get('/v2/albums/111')
      .query({ countryCode: 'NO' })
      .times(3)
      .reply(429, { error: 'rate_limited' }, { 'Retry-After': '1' });

    // All succeed after retry
    nock('https://openapi.tidal.com')
      .get('/v2/albums/111')
      .query({ countryCode: 'NO' })
      .times(3)
      .reply(200, { id: 111, title: 'Concurrent Rate Limit Test' });

    const promises = [
      tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/111', { params: { countryCode: 'NO' } }),
      tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/111', { params: { countryCode: 'NO' } }),
      tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/111', { params: { countryCode: 'NO' } })
    ];

    const results = await Promise.all(promises);

    results.forEach(res => {
      expect(res.data.id).toBe(111);
    });
  }, 10000);

  // Edge case: Token expiry during rate limiting
  test('handles token expiry during rate limiting scenario', async () => {
    // Set token to expire in 30 seconds (triggering proactive refresh)
    advanceTo(new Date(2025, 0, 1, 12, 0, 0));
    tidalClientInstance.setTokensForTesting('EXPIRING_SOON', 'REFRESH', 30);

    // Mock rate limit response
    nock('https://openapi.tidal.com')
      .get('/v2/albums/222')
      .query({ countryCode: 'NO' })
      .reply(429, { error: 'rate_limited' }, { 'Retry-After': '2' });

    // Mock token refresh during rate limit wait
    const tokenScope = createTokenScope({
      access_token: 'REFRESHED_DURING_RATE_LIMIT',
      refresh_token: 'REFRESH',
      expires_in: 3600
    }, 1);

    // Success after rate limit + token refresh
    nock('https://openapi.tidal.com')
      .get('/v2/albums/222')
      .query({ countryCode: 'NO' })
      .reply(200, { id: 222, title: 'Rate Limit + Token Refresh' });

    const res = await tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/222', { 
      params: { countryCode: 'NO' } 
    });

    expect(res.data.id).toBe(222);
    expect(tidalClientInstance.getAccessToken()).toBe('REFRESHED_DURING_RATE_LIMIT');
    expect(tokenScope.isDone()).toBe(true);
  }, 10000);
});

describe('TidalApiClient – Network Resilience', () => {
  test('handles DNS resolution failures with proper error', async () => {
    tidalClientInstance.setTokensForTesting('VALID', 'REFRESH', 7200); // 2 hours - avoid proactive refresh

    // Mock potential token refresh (allow it if client decides to, should not affect test logic)
    // eslint-disable-next-line no-unused-vars
    const tokenScope = createTokenScope({}, Infinity); // Persist, allow calls if needed

    nock('https://openapi.tidal.com')
      .get('/v2/albums/333')
      .query({ countryCode: 'NO' })
      .replyWithError({ code: 'ENOTFOUND', hostname: 'openapi.tidal.com' })
      .persist();

    await expect(
      tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/333', { 
        params: { countryCode: 'NO' } 
      })
    ).rejects.toHaveProperty('code', 'ENOTFOUND');
  }, 10000); // Set test timeout to 10 seconds

  test('handles SSL certificate errors gracefully', async () => {
    tidalClientInstance.setTokensForTesting('VALID', 'REFRESH', 7200); // 2 hours - avoid proactive refresh

    // Mock potential token refresh (allow it if client decides to, should not affect test logic)
    // eslint-disable-next-line no-unused-vars
    const tokenScope = createTokenScope({}, Infinity); // Persist, allow calls if needed

    nock('https://openapi.tidal.com')
      .get('/v2/albums/444')
      .query({ countryCode: 'NO' })
      .replyWithError({ code: 'CERT_UNTRUSTED' })
      .persist();

    await expect(
      tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/444', { 
        params: { countryCode: 'NO' } 
      })
    ).rejects.toHaveProperty('code', 'CERT_UNTRUSTED');
  });

  test('validates nock expectations are met', async () => {
    // Set token with sufficient time to avoid proactive refresh
    tidalClientInstance.setTokensForTesting('VALID', 'REFRESH', 3600);

    // Mock the API request
    const scope = nock('https://openapi.tidal.com')
      .get('/v2/albums/555')
      .query({ countryCode: 'NO' })
      .reply(200, { id: 555, title: 'Validation Test' });

    // Mock potential token refresh (in case ensureValidToken decides to refresh)
    let tokenPersistenceScope = nock('https://auth.tidal.com')
      .post('/v1/oauth2/token')
      .matchHeader('Content-Type', 'application/x-www-form-urlencoded') // Ensure this matches createTokenScope
      .reply(200, {
        access_token: 'VALID', // Or NEW_TOKEN if it should align with createTokenScope
        refresh_token: 'REFRESH',
        expires_in: 3600
      })
      .persist(); // Move persist after reply

    const res = await tidalClientInstance.request('get', 'https://openapi.tidal.com/v2/albums/555', {
      params: { countryCode: 'NO' }
    });

    expect(res.data.id).toBe(555);
    expect(scope.isDone()).toBe(true); // Verify all nock expectations were satisfied
    
    // Clean up persistent scope by removing all interceptors for that host/path
    // or by specifically targeting this one if nock allows.
    // A simple nock.cleanAll() is done in afterEach, but if more fine-grained control is needed:
    nock.removeInterceptor(tokenPersistenceScope); // More robust way to clean specific persistent scopes if needed
    // Or ensure nock.cleanAll() in afterEach is sufficient.
    // For this test, we might not need to explicitly clean it if afterEach handles it.
    // However, if we want to be super explicit:
    // nock.cleanAll(); // Or more targeted removal if available and necessary.
  });
});
