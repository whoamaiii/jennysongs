# Manual OAuth Flow Test Script

## Prerequisites
1. Ensure all environment variables are set in `.env`
2. Run `npm run dev` to start the local server

## Test Steps

### 1. Initial State Check
- Open http://localhost:8888/login.html
- Verify the login page displays correctly
- Open browser DevTools > Application > Cookies
- Verify no `tidalUser` or `tidalRefresh` cookies exist

### 2. OAuth Flow Test
- Click "Login with TIDAL" button
- You should be redirected to TIDAL's authorization page
- Note: If you see a TIDAL error about redirect_uri, you'll need to register the callback URL with TIDAL

### 3. Callback Handling
- After authorizing (or denying), you should be redirected back
- Check for cookies:
  - `tidalUser`: Should contain user info
  - `tidalRefresh`: Should contain refresh token
  - `tidalState`: Should be cleared (Max-Age=0)

### 4. Authenticated API Test
- Navigate to http://localhost:8888/index.html
- Open DevTools > Network tab
- The app should call `/.netlify/functions/get-playlist-oauth`
- Verify the request includes cookies
- Verify the response contains playlist data

### 5. Error Handling Tests

#### Test: Authorization Denial
1. Clear all cookies
2. Go to login page
3. Click login button
4. Deny authorization on TIDAL
5. Verify redirect to `/login.html?error=authorization_denied`
6. Verify error message displays

#### Test: Expired Token
1. Manually edit `tidalUser` cookie expiry to past date
2. Refresh the main app
3. Verify automatic token refresh or redirect to login

#### Test: Missing Cookies
1. Delete `tidalRefresh` cookie only
2. Try to access playlist
3. Verify 401 response and redirect to login

## Expected Results
- ✅ Login flow redirects to TIDAL and back
- ✅ Cookies are set with correct flags (HttpOnly, SameSite)
- ✅ Playlist data loads for authenticated users
- ✅ Errors redirect to login with appropriate messages
- ✅ Token refresh happens automatically

## Troubleshooting

### "redirect_uri_mismatch" Error
The callback URL must be registered with TIDAL. For local development:
- URL: `http://localhost:8888/.netlify/functions/tidal-callback`

### CORS Errors
Ensure you're using `npm run dev` (Netlify Dev) instead of directly accessing files.

### Cookie Not Set
Check browser console for Set-Cookie warnings. Common issues:
- SameSite policy violations
- Secure flag on HTTP localhost