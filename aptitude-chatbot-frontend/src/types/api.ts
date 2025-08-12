// API related types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp?: string;
}

export interface NetworkError extends Error {
  isNetworkError: true;
  retryable: boolean;
  statusCode?: number;
}

export interface AuthError extends Error {
  isAuthError: true;
  requiresLogin: boolean;
  statusCode?: number;
}

export interface ValidationError extends Error {
  isValidationError: true;
  field?: string;
  statusCode: 400;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiRequestConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  requiresAuth?: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions extends ApiRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
}
