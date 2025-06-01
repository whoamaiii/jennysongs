/** @jest-environment node */
const nock = require('nock');
nock.disableNetConnect(); // fail tests if any real HTTP slips through

const { tidalClient: tidal } = require('../tidalClient');
const MockDate = require('mockdate');

afterEach(() => {
  nock.cleanAll();
  jest.clearAllTimers();
  jest.useRealTimers();
  MockDate.reset();
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

describe('TidalApiClient', () => {
  test('refreshTokens updates tokens and schedules refresh', async () => {
    mockTokenRefresh();   // sets up /oauth2/token expectation

    tidal.setTokensForTesting('OLD', 'OLDREFRESH', 1);
    MockDate.set(Date.now());

    // Act
    await tidal.refreshTokens();

    expect(tidal.getAccessToken()).toBe('NEW');
    expect(tidal.refreshToken).toBe('REFRESH');
    expect(tidal.expiresAt).toBeGreaterThan(Date.now());
  });

  test('request retries on 401 and refreshes token', async () => {
    mockTokenRefresh();   // sets up /oauth2/token expectation

    tidal.setTokensForTesting('OLD', 'OLDREFRESH', 3600);

    const scope = nock('https://api.tidal.com')
      .get('/some/protected/resource')
      .reply(401)
      .get('/some/protected/resource')
      .reply(200, { success: true });

    const response = await tidal.request('get', 'https://api.tidal.com/some/protected/resource');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ success: true });
    scope.done();
  });
});

afterAll(() => nock.enableNetConnect());
