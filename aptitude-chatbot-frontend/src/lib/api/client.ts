import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, RequestOptions, ApiRequestConfig } from '../../types';
import { ApiErrorHandler } from './errors';
import { RetryHandler, DEFAULT_RETRY_CONFIG } from './retry';
import { ApiConfig, getApiConfig } from './config';
import { TokenManager } from '../stores/auth';

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private retryHandler: RetryHandler;
  private tokenRefreshPromise: Promise<void> | null = null;
  private config: ApiConfig;

  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...getApiConfig(), ...config };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.retryHandler = new RetryHandler(this.config.retries);
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle token refresh for 401 errors
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.refreshTokenIfNeeded();
            const token = this.getAccessToken();
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.handleAuthFailure();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(ApiErrorHandler.createError(error));
      }
    );
  }

  private getAccessToken(): string | null {
    return TokenManager.getAccessToken();
  }

  private getRefreshToken(): string | null {
    return TokenManager.getRefreshToken();
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.performTokenRefresh();

    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(
        `${this.axiosInstance.defaults.baseURL}/auth/refresh`,
        {
          refresh_token: refreshToken,
        }
      );

      const { access_token, refresh_token: newRefreshToken } = response.data;

      TokenManager.setTokens({
        access: access_token,
        refresh: newRefreshToken || refreshToken,
      });
    } catch (error) {
      // Clear tokens on refresh failure
      TokenManager.clearTokens();
      throw error;
    }
  }

  private handleAuthFailure(): void {
    // Clear tokens and redirect to login
    TokenManager.clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  async request<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      data,
      params,
      headers,
      timeout = this.config.timeout,
      retries = this.config.retries.maxRetries,
      retryDelay = this.config.retries.baseDelay,
      requiresAuth = true,
    } = options;

    const config: AxiosRequestConfig = {
      method,
      url,
      data,
      params,
      headers,
      timeout,
    };

    const operation = async (): Promise<ApiResponse<T>> => {
      const response: AxiosResponse<ApiResponse<T>> =
        await this.axiosInstance.request(config);
      return response.data;
    };

    // Use retry handler for retryable requests
    if (retries > 0) {
      return this.retryHandler.execute(operation, (error) =>
        ApiErrorHandler.isRetryableError(error)
      );
    }

    return operation();
  }

  // Convenience methods
  async get<T = any>(
    url: string,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestOptions, 'method' | 'data'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', data });
  }

  async put<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestOptions, 'method' | 'data'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', data });
  }

  async delete<T = any>(
    url: string,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async patch<T = any>(
    url: string,
    data?: any,
    options: Omit<RequestOptions, 'method' | 'data'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', data });
  }

  // Streaming support for chat
  async streamRequest(url: string, data: any): Promise<ReadableStream> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${this.axiosInstance.defaults.baseURL}${url}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw ApiErrorHandler.createError({
        response: {
          status: response.status,
          data: await response
            .json()
            .catch(() => ({ message: response.statusText })),
        },
      });
    }

    if (!response.body) {
      throw new Error('Response body is not available for streaming');
    }

    return response.body;
  }
}

// Create singleton instance
export const apiClient = new ApiClient({});
