const nock = require('nock');
const { TidalApiClient } = require('..');

describe('TidalApiClient Integration Tests', () => {
  let client;
  
  beforeEach(() => {
    nock.cleanAll();
    client = new TidalApiClient('test-client-id', 'test-client-secret', 'http://localhost/callback');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('OAuth Flow', () => {
    test('should generate correct authorization URL', () => {
      const url = client.getAuthorizationUrl('test-state');
      expect(url).toContain('https://auth.tidal.com/v1/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
      expect(url).toContain('state=test-state');
    });

    test('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      nock('https://auth.tidal.com')
        .post('/v1/oauth2/token')
        .reply(200, mockTokenResponse);

      const result = await client.exchangeCodeForTokens('test-code');
      
      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
      expect(client.accessToken).toBe('test-access-token');
    });

    test('should handle token exchange failure', async () => {
      nock('https://auth.tidal.com')
        .post('/v1/oauth2/token')
        .reply(400, { error: 'invalid_grant' });

      await expect(client.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Token exchange failed: 400');
    });
  });

  describe('Token Refresh', () => {
    beforeEach(() => {
      // Set up client with existing tokens
      client.setTokensForTesting('old-access-token', 'test-refresh-token', 3600);
    });

    test('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      };

      nock('https://auth.tidal.com')
        .post('/v1/oauth2/token')
        .reply(200, mockRefreshResponse);

      const result = await client.refreshAccessToken();
      
      expect(result.accessToken).toBe('new-access-token');
      expect(client.accessToken).toBe('new-access-token');
    });

    test('should detect when token needs refresh', () => {
      // Token expires in 1 hour
      client.setTokensForTesting('token', 'refresh', 3600);
      expect(client.needsRefresh()).toBe(false);
      
      // Token expires in 4 minutes (less than 5 minute buffer)
      client.setTokensForTesting('token', 'refresh', 240);
      expect(client.needsRefresh()).toBe(true);
    });
  });

  describe('API Requests', () => {
    beforeEach(() => {
      client.setTokensForTesting('test-access-token', 'test-refresh-token', 3600);
    });

    test('should fetch current user with country code', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        countryCode: 'NO'
      };

      nock('https://openapi.tidal.com')
        .get('/v2/user')
        .query({ countryCode: 'NO' })
        .matchHeader('authorization', 'Bearer test-access-token')
        .reply(200, mockUser);

      const result = await client.getCurrentUser('NO');
      expect(result).toEqual(mockUser);
    });

    test('should fetch playlist with items', async () => {
      const mockPlaylist = {
        data: [
          {
            resource: {
              id: 'track1',
              title: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              album: { title: 'Test Album' },
              duration: 180
            }
          }
        ]
      };

      nock('https://openapi.tidal.com')
        .get('/v2/playlists/test-playlist-id')
        .query({ countryCode: 'US', include: 'items' })
        .matchHeader('authorization', 'Bearer test-access-token')
        .reply(200, mockPlaylist);

      const result = await client.getPlaylist('test-playlist-id', 'US');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].resource.title).toBe('Test Song');
    });

    test('should auto-refresh expired token on 401', async () => {
      // Set token that needs refresh
      client.setTokensForTesting('expired-token', 'test-refresh-token', 100);

      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600
      };

      // First request fails with 401
      nock('https://openapi.tidal.com')
        .get('/v2/user')
        .query({ countryCode: 'US' })
        .matchHeader('authorization', 'Bearer expired-token')
        .reply(401, { error: 'Token expired' });

      // Token refresh
      nock('https://auth.tidal.com')
        .post('/v1/oauth2/token')
        .reply(200, mockRefreshResponse);

      // Retry succeeds with new token
      nock('https://openapi.tidal.com')
        .get('/v2/user')
        .query({ countryCode: 'US' })
        .matchHeader('authorization', 'Bearer new-access-token')
        .reply(200, { id: '123', username: 'testuser' });

      const result = await client.getCurrentUser('US');
      expect(result.username).toBe('testuser');
      expect(client.accessToken).toBe('new-access-token');
    });

    test('should handle API errors properly', async () => {
      nock('https://openapi.tidal.com')
        .get('/v2/user')
        .query({ countryCode: 'US' })
        .reply(404, { error: 'Not found' });

      await expect(client.getCurrentUser('US'))
        .rejects.toThrow('API request failed: 404');
        
      // Verify no pending mocks
      expect(nock.pendingMocks()).toHaveLength(0);
    });
  });

  describe('Test Helper', () => {
    test('setTokensForTesting should set tokens correctly', () => {
      const now = Date.now();
      client.setTokensForTesting('test-token', 'refresh-token', 3600);
      
      expect(client.accessToken).toBe('test-token');
      expect(client.refreshToken).toBe('refresh-token');
      expect(client.expiryMs).toBeGreaterThan(now);
      expect(client.expiryMs).toBeLessThan(now + 3601000);
    });
  });
});