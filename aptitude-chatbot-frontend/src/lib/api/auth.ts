import { apiClient } from './client';
import { LoginCredentials, AuthResponse, User } from '../../types';

export class AuthApi {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      '/auth/login',
      credentials
    );
    return response.data;
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  }

  async refreshToken(): Promise<{
    access_token: string;
    refresh_token?: string;
  }> {
    const response = await apiClient.post<{
      access_token: string;
      refresh_token?: string;
    }>('/auth/refresh');
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  }

  async validateToken(): Promise<{ valid: boolean; user?: User }> {
    try {
      const user = await this.getCurrentUser();
      return { valid: true, user };
    } catch (error) {
      return { valid: false };
    }
  }
}

export const authApi = new AuthApi();
