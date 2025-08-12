import {
  ApiError,
  NetworkError,
  AuthError,
  ValidationError,
} from '../../types';

// Type guards for different error types
export function isApiError(error: any): error is ApiError {
  return (
    error && typeof error === 'object' && 'code' in error && 'message' in error
  );
}

export function isNetworkError(error: any): error is NetworkError {
  return error && error.isNetworkError === true;
}

export function isAuthError(error: any): error is AuthError {
  return error && error.isAuthError === true;
}

export function isValidationError(error: any): error is ValidationError {
  return error && error.isValidationError === true;
}

// Utility functions for error handling
export function getErrorMessage(error: any): string {
  if (isNetworkError(error)) {
    return 'Network connection failed. Please check your internet connection.';
  }

  if (isAuthError(error)) {
    return error.requiresLogin
      ? 'Please log in to continue.'
      : 'You do not have permission to perform this action.';
  }

  if (isValidationError(error)) {
    return error.field
      ? `Invalid ${error.field}: ${error.message}`
      : error.message;
  }

  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

export function shouldShowRetryButton(error: any): boolean {
  return (
    isNetworkError(error) ||
    (isApiError(error) && error.code.startsWith('HTTP_5'))
  );
}

// URL and query parameter utilities
export function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, any>
): string {
  const url = new URL(path, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

export function parseQueryParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

// Token utilities
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true;
  }
}

export function getTokenExpirationTime(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000; // Convert to milliseconds
  } catch {
    return null;
  }
}

// Request utilities
export function createAbortController(timeoutMs?: number): AbortController {
  const controller = new AbortController();

  if (timeoutMs) {
    setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  return controller;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Data transformation utilities
export function sanitizeApiResponse<T>(data: any): T {
  // Remove any potentially dangerous properties
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    delete sanitized.__proto__;
    delete sanitized.constructor;
    return sanitized;
  }
  return data;
}

export function formatApiError(error: any): string {
  const message = getErrorMessage(error);
  const timestamp = new Date().toLocaleString();
  return `[${timestamp}] ${message}`;
}
