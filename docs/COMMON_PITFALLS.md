# Common TIDAL OAuth Implementation Pitfalls

## 1. Wrong Base URL

**Problem**: Using `https://api.tidal.com` instead of `https://openapi.tidal.com` for API calls.

**Symptom**: 404 errors on all API requests

**Solution**: 
```javascript
// ❌ Wrong
const baseUrl = 'https://api.tidal.com';

// ✅ Correct
const baseUrl = 'https://openapi.tidal.com';
```

## 2. Missing CountryCode Query Parameter

**Problem**: TIDAL API requires countryCode on most endpoints but it's easy to forget.

**Symptom**: 400 Bad Request errors

**Solution**:
```javascript
// ❌ Wrong
await fetch('/v2/playlists/123');

// ✅ Correct
await fetch('/v2/playlists/123?countryCode=US');
```

## 3. Race Condition on Token Refresh

**Problem**: Multiple concurrent requests triggering multiple token refreshes.

**Symptom**: 
- Token refresh endpoint called multiple times
- Potential 429 rate limit errors
- Inconsistent token state

**Solution**: Use a promise cache
```javascript
let refreshPromise = null;

async function getAccessToken() {
  if (!refreshPromise) {
    refreshPromise = doRefresh()
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
```

## 4. Incorrect Content-Type Header

**Problem**: Using wrong Content-Type for TIDAL API v2

**Symptom**: 415 Unsupported Media Type errors

**Solution**:
```javascript
// ❌ Wrong
'Content-Type': 'application/json'

// ✅ Correct
'Content-Type': 'application/vnd.tidal.v1+json'
```

## 5. Cookie Parsing Issues

**Problem**: Forgetting to decode URI-encoded cookie values

**Symptom**: JSON parse errors when reading user data from cookies

**Solution**:
```javascript
// ❌ Wrong
const user = JSON.parse(cookies.tidalUser);

// ✅ Correct
const user = JSON.parse(decodeURIComponent(cookies.tidalUser));
```

## 6. CORS in Local Development

**Problem**: CORS errors when testing locally

**Symptom**: "Access to fetch at 'https://auth.tidal.com' from origin 'http://localhost:8888' has been blocked by CORS policy"

**Solution**: Use Netlify Dev which proxies functions correctly
```bash
# ❌ Wrong
node netlify/functions/tidal-login.js

# ✅ Correct
npm run dev  # Uses netlify dev
```

## 7. Token Expiry Buffer Too Small

**Problem**: Checking token expiry without buffer time

**Symptom**: 401 errors due to token expiring between check and use

**Solution**:
```javascript
// ❌ Wrong - No buffer
if (Date.now() > expiryMs) { refresh(); }

// ✅ Correct - 5 minute buffer
if (Date.now() > (expiryMs - 300000)) { refresh(); }
```

## 8. Missing Error State in OAuth Callback

**Problem**: Not handling when user denies authorization

**Symptom**: App crashes or shows blank page after user cancels login

**Solution**:
```javascript
const { code, state, error } = event.queryStringParameters || {};

if (error) {
  return {
    statusCode: 302,
    headers: {
      'Location': '/login.html?error=authorization_denied'
    }
  };
}
```

## 9. Jest Imports in Production Code

**Problem**: Accidentally importing test utilities in production functions

**Symptom**: Runtime errors in Netlify Functions

**Solution**: Use ESLint rule to catch during CI
```javascript
// .eslintrc.js
rules: {
  'custom/no-jest-imports': 'error'
}
```

## 10. Hardcoded Redirect URIs

**Problem**: Redirect URI mismatch between environments

**Symptom**: OAuth error "redirect_uri_mismatch"

**Solution**: Use environment variables
```javascript
// ❌ Wrong
const redirectUri = 'http://localhost:8888/.netlify/functions/tidal-callback';

// ✅ Correct
const redirectUri = process.env.TIDAL_REDIRECT_URI || 
  `${process.env.URL}/.netlify/functions/tidal-callback`;
```