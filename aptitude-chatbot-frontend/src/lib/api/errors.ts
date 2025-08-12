import {
  ApiError,
  NetworkError,
  AuthError,
  ValidationError,
} from '../../types';

export class ApiErrorHandler {
  static createError(
    error: any
  ): ApiError | NetworkError | AuthError | ValidationError {
    // Network errors (no response)
    if (!error.response) {
      const networkError = new Error(
        error.message || 'Network error occurred'
      ) as NetworkError;
      networkError.isNetworkError = true;
      networkError.retryable = true;
      return networkError;
    }

    const { status, data } = error.response;

    // Authentication errors
    if (status === 401 || status === 403) {
      const authError = new Error(
        data?.message || 'Authentication failed'
      ) as AuthError;
      authError.isAuthError = true;
      authError.requiresLogin = status === 401;
      authError.statusCode = status;
      return authError;
    }

    // Validation errors
    if (status === 400) {
      const validationError = new Error(
        data?.message || 'Validation failed'
      ) as ValidationError;
      validationError.isValidationError = true;
      validationError.field = data?.field;
      validationError.statusCode = 400;
      return validationError;
    }

    // Generic API errors
    return {
      code: data?.code || `HTTP_${status}`,
      message: data?.message || error.message || 'An error occurred',
      details: data?.details,
      timestamp: new Date().toISOString(),
    };
  }

  static isRetryableError(error: any): boolean {
    if (error.isNetworkError) return error.retryable;
    if (error.isAuthError) return false;
    if (error.isValidationError) return false;

    // Retry on server errors (5xx)
    const status = error.response?.status;
    return status >= 500 && status < 600;
  }

  static shouldRefreshToken(error: any): boolean {
    return error.isAuthError && error.statusCode === 401;
  }
}
