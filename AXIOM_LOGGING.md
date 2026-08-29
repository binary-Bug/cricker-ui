## Axiom Cloud Logging Integration

This document describes the Axiom cloud logging integration in the cricket-scorer frontend application.

### Overview

The application is configured to send logs to Axiom Cloud for monitoring and analytics. All logging is handled through a centralized logger utility that uses native `fetch` API without external SDKs.

### Configuration

**Axiom Details:**

- **Dataset**: `cricker-logs`
- **API Token**: `xaat-612c4f26-d42e-4849-b34a-88826cde962a`
- **Endpoint**: `https://api.axiom.co/v1/datasets/cricker-logs/ingest`

Configuration is stored in environment files:

- `src/environments/environment.ts` (Production)
- `src/environments/environment.development.ts` (Development)

### Logger Utility

**Location**: `src/app/utils/logger.ts`

**Key Features:**

- Centralized singleton logger instance
- Native `fetch` API with `keepalive: true` for reliable delivery during navigation
- Device and environment tracking (user agent, platform, timezone, screen size, IP address, hostname)
- Automatic timestamping in ISO 8601 UTC format
- Failed logs fail silently in production
- Console logging in development mode for debugging

**Log Payload Structure:**

```json
{
  "_time": "2026-08-29T12:34:56.789Z",
  "level": "info|warn|error",
  "message": "description",
  "app": "cricker-ui",
  "userAgent": "Mozilla/...",
  "platform": "Win32",
  "language": "en-US",
  "timezone": "UTC",
  "screen": { "width": 1920, "height": 1080 },
  "hostname": "localhost",
  "ipAddress": "203.0.113.42"
}
```

### API

The logger provides the following methods:

#### `logger.initialize(isProdEnv: boolean)`

Initialize the logger with environment configuration. Called automatically in `app.config.ts`.

```typescript
logger.initialize(environment.isProdEnv);
```

#### `logger.info(message: string, metadata?: object)`

Log informational message.

```typescript
logger.info("User logged in", { userId: "123" });
```

#### `logger.warn(message: string, metadata?: object)`

Log warning message.

```typescript
logger.warn("High memory usage detected", { memoryMB: 512 });
```

#### `logger.error(message: string, metadata?: object)`

Log error message.

```typescript
logger.error("Failed to load match data", { matchId: "abc123", errorCode: 404 });
```

#### `logger.trackEvent(eventName: string, data?: object)`

Track custom analytics events.

```typescript
logger.trackEvent("match_details_viewed", { matchId: "abc123", fromPage: "stats" });
```

### Error Handling

**Global Error Handler** (`src/app/utils/global-error-handler.ts`)

A global error handler is configured in `app.config.ts` that automatically catches all unhandled Angular errors and logs them to Axiom with stack traces.

```typescript
// Automatically logged with error_name, error_stack, and source
try {
  // Some code
} catch (error) {
  // Automatically caught by global handler and logged to Axiom
}
```

### Logged Events

#### App Initialization

- **Event**: `app_initialized`
- **When**: On app bootstrap
- **Data**: URL, timestamp

#### Page Navigation

- **Event**: `page_viewed`
- **When**: When a route changes
- **Data**: Route URL, normalized URL

#### Visibility Changes

- **Event**: `visibility_changed`
- **When**: When the page becomes hidden/visible (tab switch, app backgrounding)
- **Data**: Hidden state, visibility state

#### Match Details View

- **Event**: `match_details_viewed`
- **When**: When a user navigates to match details
- **Data**: Match ID, player name, previous page context

- **Event**: `match_details_loaded`
- **When**: After match data loads
- **Data**: Timestamp

#### Player Details View

- **Event**: `player_details_viewed`
- **When**: When a user navigates to player details
- **Data**: Player name, previous page context, player stats (runs, wickets, matches)

#### Stats Page View

- **Event**: `stats_viewed`
- **When**: When stats page is initialized
- **Data**: Selected stat type, timestamp

- **Event**: `stats_loaded`
- **When**: When stats data finishes loading
- **Data**: Player count, timestamp

#### Global Errors

- **Event**: Error logged with level `error`
- **When**: Any unhandled error in Angular
- **Data**: Error name, error message, stack trace, source (angular-global-handler)

### Development vs Production

**Development Mode**:

- Logs are printed to browser console
- No data sent to Axiom
- Useful for debugging and testing

**Production Mode**:

- Logs are sent to Axiom Cloud
- Console errors are suppressed
- Logging failures fail silently

### Best Practices

1. **Always use async/await or .catch()** when calling logger methods to prevent unhandled promise rejections:

   ```typescript
   await logger.trackEvent("event_name", data);
   // or
   logger.trackEvent("event_name", data).catch((err) => console.error(err));
   ```

2. **Include relevant context** in metadata:

   ```typescript
   logger.trackEvent("action_performed", {
     userId: user.id,
     actionType: "delete",
     targetId: item.id,
     timestamp: new Date().toISOString(),
   });
   ```

3. **Sensitive data**: Avoid logging passwords, tokens, or personal identifiable information (PII).

4. **Performance**: Logging is non-blocking, but bulk operations (>100 logs/second) may cause network contention. For high-frequency events, consider batching.

### Troubleshooting

**Logs not appearing in Axiom**:

1. Verify you're in production mode (check network tab for POST requests to api.axiom.co)
2. Confirm the API token is correct
3. Check browser console for fetch errors
4. Verify CORS is allowed (should be, as `mode: 'cors'` is set)

**Development logging**:

1. Open browser console (F12)
2. Look for `[INFO]`, `[WARN]`, `[ERROR]`, or `[EVENT]` prefixed messages
3. Verify `NODE_ENV !== 'development'` is true if Axiom should be used

### Integration Points

1. **App Bootstrap**: `src/app/app.config.ts` - Initializes logger and global error handler
2. **App Component**: `src/app/app.component.ts` - Tracks app initialization and page navigation
3. **Match Details**: `src/app/components/match-details/match-details.component.ts` - Tracks match views
4. **Player Details**: `src/app/components/player-details/player-details.component.ts` - Tracks player views
5. **Stats**: `src/app/components/stats/stats.component.ts` - Tracks stats page views
6. **Global Error Handler**: `src/app/utils/global-error-handler.ts` - Catches and logs unhandled errors

### Future Enhancements

- Add session tracking with session IDs
- Implement log batching for high-frequency events
- Add performance monitoring (Web Vitals, load times)
- Implement user identification tracking
- Add custom dimensions for team/league/tournament context
