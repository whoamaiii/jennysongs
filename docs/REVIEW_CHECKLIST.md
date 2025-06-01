# Code Review Checklist

Use this checklist for every PR to ensure consistent quality and security standards.

## Security & Privacy

| ✓ | Item | Description |
|---|------|-------------|
| [ ] | **Environment Variables** | No secrets in code; all sensitive data uses `process.env` |
| [ ] | **Cookie Flags** | All cookies have `Secure`, `HttpOnly`, `SameSite=Strict` |
| [ ] | **Log Redaction** | No user PII, tokens, or secrets in console logs |
| [ ] | **HTTPS Only** | All external API calls use HTTPS endpoints |
| [ ] | **Token Handling** | OAuth tokens stored securely, never in localStorage |
| [ ] | **Error Messages** | No sensitive info leaked in error responses |

## Code Quality

| ✓ | Item | Description |
|---|------|-------------|
| [ ] | **Test Coverage** | New code has ≥90% test coverage |
| [ ] | **Error Handling** | All async operations have proper error handling |
| [ ] | **Type Safety** | Function parameters and returns are properly typed |
| [ ] | **Performance** | No unnecessary API calls or blocking operations |
| [ ] | **Memory Leaks** | Event listeners removed, intervals cleared |

## TIDAL Integration Specific

| ✓ | Item | Description |
|---|------|-------------|
| [ ] | **Country Code** | All TIDAL API requests include `countryCode=NO` |
| [ ] | **Rate Limiting** | Implements retry logic with exponential backoff |
| [ ] | **Token Refresh** | Handles token expiration gracefully |
| [ ] | **Network Errors** | Proper timeout and connection error handling |

## Testing

| ✓ | Item | Description |
|---|------|-------------|
| [ ] | **Unit Tests** | All new functions have corresponding unit tests |
| [ ] | **Integration Tests** | API endpoints tested with mocked dependencies |
| [ ] | **Edge Cases** | Tests cover error conditions and boundary values |
| [ ] | **No Network Calls** | Tests use nock mocks, no real external requests |

## Documentation

| ✓ | Item | Description |
|---|------|-------------|
| [ ] | **Function Comments** | Complex logic has explanatory comments |
| [ ] | **README Updates** | New features documented in README |
| [ ] | **API Changes** | Breaking changes clearly documented |

---
**Last updated:** June 1, 2025
