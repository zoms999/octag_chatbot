# API Client Implementation

This directory contains the complete TypeScript API client implementation for the aptitude chatbot frontend.

## Overview

The API client provides a robust, type-safe interface for communicating with the backend Python FastAPI server. It includes comprehensive error handling, automatic token management, retry logic, and streaming support.

## Architecture

### Core Components

1. **Types** (`../../types/`)
   - `user.ts` - User authentication and profile types
   - `chat.ts` - Chat messages and conversation types
   - `test.ts` - Test results and ETL job types
   - `api.ts` - API response and error types

2. **Client** (`client.ts`)
   - Main `ApiClient` class with Axios integration
   - Automatic token refresh and management
   - Request/response interceptors
   - Streaming support for real-time features

3. **Error Handling** (`errors.ts`)
   - `ApiErrorHandler` for consistent error processing
   - Type-safe error classification
   - Retry logic integration

4. **Retry Logic** (`retry.ts`)
   - `RetryHandler` with exponential backoff
   - Configurable retry policies
   - Jitter to prevent thundering herd

5. **Service APIs**
   - `auth.ts` - Authentication endpoints
   - `chat.ts` - Chat and streaming endpoints
   - `tests.ts` - Test results and ETL endpoints

6. **Utilities** (`utils.ts`)
   - Type guards for error handling
   - Token validation utilities
   - URL and query parameter helpers

## Features

### Authentication

- JWT token management (access + refresh)
- Automatic token refresh
- Secure token storage
- Login/logout functionality

### Error Handling

- Network error detection and retry
- Authentication error handling
- Validation error processing
- User-friendly error messages

### Streaming Support

- Server-Sent Events (SSE) for chat
- Real-time ETL progress monitoring
- Connection management and reconnection

### Type Safety

- Full TypeScript coverage
- Strict type checking
- Runtime type validation
- IntelliSense support

## Usage Examples

### Basic API Calls

```typescript
import { apiClient } from '@/lib/api';

// GET request
const response = await apiClient.get('/endpoint');

// POST request with data
const response = await apiClient.post('/endpoint', { data: 'value' });
```

### Authentication

```typescript
import { authApi } from '@/lib/api';

// Login
const authResponse = await authApi.login({
  username: 'user@example.com',
  password: 'password',
  loginType: 'personal',
});

// Get current user
const user = await authApi.getCurrentUser();
```

### Chat Streaming

```typescript
import { chatApi } from '@/lib/api';

// Send streaming message
const stream = await chatApi.streamMessage({
  message: 'Hello, AI!',
});

// Process stream
for await (const chunk of chatApi.parseStreamingResponse(stream)) {
  console.log(chunk.content);
}
```

### ETL Job Monitoring

```typescript
import { testsApi } from '@/lib/api';

// Start ETL job
const job = await testsApi.startETLJob({
  userId: 'user123',
  anpSeq: 12345,
});

// Monitor progress
for await (const status of testsApi.monitorETLJob(job.jobId)) {
  console.log(`Progress: ${status.progress}%`);
}
```

## Configuration

The API client is configurable through environment variables and runtime configuration:

```typescript
// Environment variables
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

// Runtime configuration
const client = new ApiClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  retries: {
    maxRetries: 3,
    baseDelay: 1000
  }
});
```

## Error Types

The client provides typed errors for different scenarios:

- `NetworkError` - Connection issues, retryable
- `AuthError` - Authentication failures
- `ValidationError` - Input validation errors
- `ApiError` - General API errors

## Testing

The implementation includes comprehensive error handling and type safety that can be tested:

```typescript
import { ApiErrorHandler, isNetworkError } from '@/lib/api';

// Test error handling
const error = ApiErrorHandler.createError(mockError);
if (isNetworkError(error)) {
  // Handle network error
}
```

## Integration with Stores

The API client is designed to work seamlessly with Zustand stores:

```typescript
// In your store
import { authApi, chatApi } from '@/lib/api';

const useAuthStore = create((set) => ({
  login: async (credentials) => {
    const response = await authApi.login(credentials);
    set({ user: response.user });
  },
}));
```

## Performance Considerations

- Automatic request deduplication
- Response caching where appropriate
- Efficient streaming with early termination
- Bundle size optimization through tree shaking

## Security Features

- Secure token storage
- Automatic token refresh
- CSRF protection
- Input sanitization
- Environment-based configuration
