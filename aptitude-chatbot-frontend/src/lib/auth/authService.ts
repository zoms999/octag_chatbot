import { apiClient } from '../api/client';
import { LoginCredentials, AuthResponse, User } from '../../types';

export class AuthService {
  /**
   * Login with credentials
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', {
      username: credentials.username,
      password: credentials.password,
      loginType: credentials.loginType,
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Login failed');
    }

    return response.data;
  }

  /**
   * Refresh access token
   */
  static async refreshToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token?: string }> {
    const response = await apiClient.post<{
      access_token: string;
      refresh_token?: string;
    }>('/api/auth/refresh', {
      refresh_token: refreshToken,
    });

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Token refresh failed');
    }

    return response.data;
  }

  /**
   * Get current user info
   */
  static async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/api/auth/me');

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get user info');
    }

    return response.data;
  }

  /**
   * Logout (server-side)
   */
  static async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      // Ignore logout errors - we'll clear tokens anyway
      console.warn('Logout request failed:', error);
    }
  }

  /**
   * Validate token
   */
  static async validateToken(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  }
}
