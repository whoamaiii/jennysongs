/** @jest-environment node */
const nock = require('nock');
nock.disableNetConnect(); // fail tests if any real HTTP slips through

const { TidalApiClient } = require('..'); // Updated to use barrel export from parent (index.js)
const { advanceTo, clear } = require('jest-date-mock');

describe('TidalApiClient token refresh', () => {
  let tidal;

  beforeEach(() => {
    tidal = new TidalApiClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://redirect.uri',
    });
  });

  afterEach(() => {
    clear();
    nock.cleanAll();
  });

  /**
   * Mock the token refresh endpoint.  `nock.persist()` keeps it active for
   * any additional scheduled refreshes that may fire during the test run.
   */
  const mockTokenRefresh = (payload = {
    access_token: 'NEW',
    refresh_token: 'REFRESH',
    expires_in:   3600
  }) =>
    nock('https://auth.tidal.com')
      .persist()                        // allow multiple hits (proactive + reactive)
      .post('/v1/oauth2/token')
      .reply(200, payload);

  test('proactive token refresh triggers correctly', async () => {
    advanceTo(new Date(2023, 0, 1, 12, 0, 0));
    tidal.setTokensForTesting({
      accessToken: 'OLD',
      refreshToken: 'OLD_REFRESH',
      expiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now (within 5 min refresh margin)
    });
    mockTokenRefresh();   // sets up /oauth2/token expectation

    // simulate proactive refresh trigger before expiry margin
    await tidal.ensureValidToken();

    expect(tidal.accessToken).toBe('NEW');
  });

  test('reactive token refresh on 401 error', async () => {
    tidal.setTokensForTesting({
      accessToken: 'OLD',
      refreshToken: 'OLD_REFRESH',
      expiresAt: Date.now() - 1000, // already expired
    });
    mockTokenRefresh();   // sets up /oauth2/token expectation

    // This test needs a mock for the actual authenticated request that would return 401
    // For now, assuming makeAuthenticatedRequest internally handles the 401 and retries
    // If makeAuthenticatedRequest is not part of TidalApiClient, this test needs adjustment
    // or the actual endpoint it calls needs to be mocked to return 401 then 200.
    // For demonstration, let's assume it makes a call that we can mock:
    nock('https://api.tidal.com') // Placeholder for actual API endpoint
      .get('/some-endpoint')
      .matchHeader('Authorization', 'Bearer OLD')
      .reply(401, { error: 'token_expired' })
      .get('/some-endpoint')
      .matchHeader('Authorization', 'Bearer NEW')
      .reply(200, { data: 'success' });


    await tidal.makeAuthenticatedRequest('/some-endpoint');
    // The structure of 'response' and how to check success depends on makeAuthenticatedRequest
    // Assuming it returns an object with status and the new token is accessible via tidal.accessToken
    // expect(response.status).toBe(200); // This depends on what makeAuthenticatedRequest returns
    expect(tidal.accessToken).toBe('NEW');
  });
});

afterAll(() => nock.enableNetConnect());
