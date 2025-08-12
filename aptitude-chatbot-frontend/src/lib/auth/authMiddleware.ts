import { TokenManager } from '../stores/auth';
import { AuthService } from './authService';
import { isTokenExpired, shouldRefreshToken } from './tokenRefresh';

/**
 * Auth middleware for automatic token management in API requests
 */
export class AuthMiddleware {
  private static refreshPromise: Promise<void> | null = null;

  /**
   * Get valid access token, refreshing if necessary
   */
  static async getValidToken(): Promise<string | null> {
    const accessToken = TokenManager.getAccessToken();
    
    if (!accessToken) {
      return null;
    }

    // If token is expired, try to refresh
    if (isTokenExpired()) {
      try {
        await this.refreshToken();
        return TokenManager.getAccessToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        return null;
      }
    }

    // If token should be refreshed proactively, do it in background
    if (shouldRefreshToken()) {
      this.refreshTokenInBackground();
    }

    return accessToken;
  }

  /**
   * Refresh token with deduplication
   */
  static async refreshToken(): Promise<void> {
    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = this.performRefresh(refreshToken);

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private static async performRefresh(refreshToken: string): Promise<void> {
    try {
      const response = await AuthService.refreshToken(refreshToken);
      const newTokens = {
        access: response.access_token,
        refresh: response.refresh_token || refreshToken,
      };

      TokenManager.setTokens(newTokens);
    } catch (error) {
      // Clear tokens on refresh failure
      TokenManager.clearTokens();
      throw error;
    }
  }

  /**
   * Refresh token in background without blocking
   */
  private static refreshTokenInBackground(): void {
    this.refreshToken().catch((error) => {
      console.warn('Background token refresh failed:', error);
    });
  }

  /**
   * Add authorization header to request config
   */
  static async addAuthHeader(headers: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.getValidToken();
    
    if (token) {
      return {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
    }

    return headers;
  }

  /**
   * Check if request should include auth header
   */
  static shouldIncludeAuth(url: string, options: { requiresAuth?: boolean } = {}): boolean {
    const { requiresAuth = true } = options;
    
    // Don't include auth for login/refresh endpoints
    if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return false;
    }

    return requiresAuth;
  }

  /**
   * Handle auth errors from API responses
   */
  static handleAuthError(status: number, error: any): boolean {
    if (status === 401) {
      // Clear tokens on 401 errors
      TokenManager.clearTokens();
      
      // Redirect to login if in browser
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      
      return true; // Indicates auth error was handled
    }

    return false; // Not an auth error
  }

  /**
   * Prepare request with auth middleware
   */
  static async prepareRequest(
    url: string,
    options: RequestInit & { requiresAuth?: boolean } = {}
  ): Promise<RequestInit> {
    const { requiresAuth = true, headers = {}, ...restOptions } = options;

    let requestHeaders = { ...headers } as Record<string, string>;

    // Add auth header if needed
    if (this.shouldIncludeAuth(url, { requiresAuth })) {
      requestHeaders = await this.addAuthHeader(requestHeaders);
    }

    return {
      ...restOptions,
      headers: requestHeaders,
    };
  }

  /**
   * Enhanced fetch with auth middleware
   */
  static async fetch(
    url: string,
    options: RequestInit & { requiresAuth?: boolean } = {}
  ): Promise<Response> {
    const requestOptions = await this.prepareRequest(url, options);
    
    const response = await fetch(url, requestOptions);

    // Handle auth errors
    if (response.status === 401 && this.shouldIncludeAuth(url, options)) {
      this.handleAuthError(response.status, null);
    }

    return response;
  }
}