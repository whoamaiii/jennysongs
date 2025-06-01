# TIDAL OAuth Implementation

This directory contains the complete TIDAL OAuth implementation with user authorization flow.

## 🏗️ Architecture

The implementation follows OAuth 2.0 authorization code flow:

1. User clicks login → redirected to TIDAL
2. User authorizes → TIDAL redirects back with code
3. Backend exchanges code for tokens
4. Tokens stored in secure HttpOnly cookies
5. API requests use access token with auto-refresh

See [TIDAL_OAUTH_ARCHITECTURE.md](./TIDAL_OAUTH_ARCHITECTURE.md) for detailed flow.

## 🚀 Quick Start

1. **Environment Setup**
   ```bash
   # .env file
   TIDAL_CLIENT_ID=your_client_id
   TIDAL_CLIENT_SECRET=your_client_secret
   TIDAL_PLAYLIST_ID=your_playlist_id
   ```

2. **Local Development**
   ```bash
   npm install
   npm run dev
   ```

3. **Run Tests**
   ```bash
   npm test        # Run all tests
   npm run ci      # Run linting + tests
   ```

## 📁 File Structure

```
netlify/functions/
├── tidal/
│   ├── tidalClient.js         # OAuth client implementation
│   ├── index.js               # Barrel export
│   └── __tests__/
│       └── *.test.js          # Integration tests
├── tidal-login.js             # OAuth initiation endpoint
├── tidal-callback.js          # OAuth callback handler
└── get-playlist-oauth.js      # Protected playlist endpoint
```

## 🔒 Security Features

- **CSRF Protection**: State parameter validation
- **Secure Cookies**: HttpOnly, SameSite=Lax, Secure flags
- **Token Rotation**: Automatic refresh with race prevention
- **No Client Secrets**: All secrets stay server-side

## 🧪 Testing

The implementation includes:
- Integration tests with nock for API mocking
- ESLint rules preventing test code in production
- Pre-push hooks via Husky for quality gates

## 📚 Documentation

- [Architecture](./TIDAL_OAUTH_ARCHITECTURE.md) - System design and flow
- [Review Checklist](./REVIEW_CHECKLIST.md) - Pre-deployment checklist
- [Common Pitfalls](./COMMON_PITFALLS.md) - Known issues and solutions
- [Test Guide](./test-oauth-flow.md) - Manual testing steps

## 🛠️ Tools Used

| Tool | Purpose |
|------|---------|
| Jest + Nock | Integration testing with HTTP mocking |
| ESLint | Code quality + no test imports in prod |
| Husky | Git hooks for pre-push validation |
| Netlify Functions | Serverless OAuth handlers |

## 🏁 Deployment

1. Ensure all tests pass: `npm run ci`
2. Deploy to Netlify: `npm run deploy`
3. Set environment variables in Netlify dashboard
4. Register production callback URL with TIDAL

## ⚠️ Important Notes

- The `tidalClient.setTokensForTesting()` method is for tests only
- Always use countryCode parameter for TIDAL API calls
- Token refresh has a 5-minute buffer to prevent edge cases
- Race conditions are prevented with promise caching

---

For questions or issues, refer to the documentation or run the manual test flow.