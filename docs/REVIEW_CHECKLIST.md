# TIDAL OAuth Review Checklist

Before deploying or reviewing the TIDAL OAuth implementation, ensure all items are checked:

## Environment Configuration
- [ ] `TIDAL_CLIENT_ID` environment variable is set
- [ ] `TIDAL_CLIENT_SECRET` environment variable is set
- [ ] `TIDAL_REDIRECT_URI` environment variable is set (or defaults to `${URL}/.netlify/functions/tidal-callback`)
- [ ] `TIDAL_PLAYLIST_ID` environment variable is set

## Security
- [ ] Cookies are configured with `HttpOnly` flag
- [ ] Cookies are configured with `SameSite=Lax`
- [ ] Cookies are configured with `Secure` flag (for production)
- [ ] State parameter is used for CSRF protection
- [ ] Client secrets are never exposed to frontend
- [ ] No sensitive data in console logs

## API Calls
- [ ] CountryCode is sent on every TIDAL API call
- [ ] Authorization header format is correct: `Bearer ${token}`
- [ ] Content-Type header is set to `application/vnd.tidal.v1+json`
- [ ] X-Tidal-Token header includes client ID

## Token Management
- [ ] Access tokens are refreshed proactively (5-minute buffer)
- [ ] Refresh tokens are stored securely in HttpOnly cookies
- [ ] Race condition prevention for concurrent refreshes
- [ ] 401 responses trigger automatic token refresh
- [ ] Failed refresh attempts are handled gracefully

## Testing
- [ ] Integration tests pass (`npm test`)
- [ ] ESLint checks pass (`npm run lint`)
- [ ] No Jest imports in production code
- [ ] Manual smoke test completed

## Error Handling
- [ ] OAuth errors redirect to login with error parameter
- [ ] API failures return appropriate status codes
- [ ] Network errors are caught and handled
- [ ] Fallback behavior for unavailable services