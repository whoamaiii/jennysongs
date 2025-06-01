// jest-environment node
const nock = require('nock');
nock.disableNetConnect(); // fail tests if any real HTTP slips through

const { TidalApiClient } = require('../tidalClient');
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
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
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

    const response = await tidal.makeAuthenticatedRequest('/some-endpoint');
    expect(response.status).toBe(200);
    expect(tidal.accessToken).toBe('NEW');
  });
});

afterAll(() => nock.enableNetConnect());
