# TIDAL User Authorization Setup Guide

This guide will help you set up the user-authorized TIDAL flow for accessing playlists with 30-second previews.

## Overview

The new implementation uses two types of tokens:

| Token | Purpose | How to get it |
|-------|---------|---------------|
| `catalogueToken` | Albums/tracks metadata | Client credentials (existing) |
| `userToken` + `refreshToken` | Playlists, favourites, previews | Authorization code flow (new) |

## 1. Environment Variables

Add these environment variables to your Netlify site:

### In Netlify Dashboard → Site Settings → Environment Variables:

```
TIDAL_CLIENT_ID=qYkX0pV73VRIZNpS
TIDAL_CLIENT_SECRET=JlOidzFnvkA1rk18GLu1vrCAVzRZ4ixQdWGOiKmz7MU=
TIDAL_PLAYLIST_ID=a7e25e82-5b90-4f74-9068-fa103012dbcc
TIDAL_REDIRECT_URI=https://YOUR-SITE.netlify.app/.netlify/functions/tidal-callback
TIDAL_SCOPES=playlists.read
```

**Important:** Replace `YOUR-SITE` with your actual Netlify site name.

### For Local Development (.env file):

```
TIDAL_CLIENT_ID=qYkX0pV73VRIZNpS
TIDAL_CLIENT_SECRET=JlOidzFnvkA1rk18GLu1vrCAVzRZ4ixQdWGOiKmz7MU=
TIDAL_PLAYLIST_ID=a7e25e82-5b90-4f74-9068-fa103012dbcc
TIDAL_REDIRECT_URI=http://localhost:8888/.netlify/functions/tidal-callback
TIDAL_SCOPES=playlists.read
```

## 2. TIDAL Developer Account Setup

1. Go to [https://developer.tidal.com](https://developer.tidal.com)
2. Log in with your TIDAL account
3. Navigate to your app settings
4. Add the redirect URI to your app configuration:
   - Production: `https://YOUR-SITE.netlify.app/.netlify/functions/tidal-callback`
   - Development: `http://localhost:8888/.netlify/functions/tidal-callback`

## 3. New Netlify Functions

The following functions have been created:

- `tidal-login.js` - Redirects users to TIDAL authorization page
- `tidal-callback.js` - Handles the OAuth callback and stores tokens
- `get-playlist.js` - Updated to use user tokens instead of client credentials

## 4. New Frontend Pages

- `login.html` - Login page with TIDAL authentication
- `success.html` - Success page after authentication
- `index.html` - Updated main page with authentication checks

## 5. Local Testing

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npx netlify dev
   ```

3. Open your browser to `http://localhost:8888`

4. Test the flow:
   - Visit `http://localhost:8888/login.html`
   - Click "Login with TIDAL"
   - Authorize the app on TIDAL
   - You'll be redirected back to the success page
   - Then automatically redirected to the main playlist page

## 6. Authentication Flow

1. **User visits the site** → Redirected to `/login.html` if not authenticated
2. **User clicks "Login with TIDAL"** → Redirected to TIDAL authorization page
3. **User authorizes the app** → TIDAL redirects to `/tidal-callback`
4. **Callback function** → Exchanges code for tokens, stores in cookies
5. **User redirected to** → `/success.html` then `/index.html`
6. **Main page** → Uses stored tokens to fetch playlist data

## 7. Token Management

- **Access tokens** are stored in `tidalUser` HttpOnly cookie (expires based on TIDAL's expiry)
- **Refresh tokens** are stored in `tidalRefresh` HttpOnly cookie (30 days)
- **Automatic refresh** can be implemented when access tokens expire

## 8. API Changes

The playlist endpoint now uses:
- **URL**: `https://openapi.tidal.com/v2/playlists/{id}/items`
- **Headers**: `Accept: application/vnd.tidal.v2+json`
- **Authentication**: User access token (not client credentials)

## 9. Features

✅ **User authentication** with TIDAL OAuth2  
✅ **Playlist access** using user permissions  
✅ **30-second previews** (when available)  
✅ **Automatic login checks** and redirects  
✅ **Token storage** in secure HttpOnly cookies  
✅ **Mobile-optimized** interface  
✅ **Error handling** for authentication failures  

## 10. Troubleshooting

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| 302 redirect to login | No `tidalUser` cookie | Check callback URL matches env var exactly |
| 401 subStatus 6004 | Wrong API endpoint or token | Ensure using v2 API with user token |
| "invalid_client" error | Wrong Basic auth header | Verify client ID:secret base64 encoding |
| Callback not working | Redirect URI mismatch | Check TIDAL app settings match env vars |

## 11. Security Notes

- Tokens are stored in **HttpOnly cookies** (not accessible via JavaScript)
- **CORS** is configured for your domain
- **Client secrets** are only used server-side
- **Refresh tokens** allow long-term access without re-authentication

## 12. Next Steps

Once working, you can enhance with:
- **Encrypted token storage** (instead of plain cookies)
- **Automatic token refresh** when access tokens expire
- **Multiple playlist support** 
- **User profile information**
- **Favorites management**

---

🎵 **Enjoy your romantic playlist with 30-second previews!** ❤️ 