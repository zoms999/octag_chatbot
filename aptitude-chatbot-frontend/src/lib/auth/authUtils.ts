import { TokenManager } from '../stores/auth';
import { isTokenExpired, shouldRefreshToken, getTokenExpiration } from './tokenRefresh';

/**
 * Utility functions for authentication management
 */
export class AuthUtils {
  /**
   * Check if user is currently authenticated
   */
  static isAuthenticated(): boolean {
    const token = TokenManager.getAccessToken();
    return token !== null && !isTokenExpired();
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  static getTimeUntilExpiration(): number | null {
    const expiration = getTokenExpiration();
    if (!expiration) return null;

    return expiration.getTime() - Date.now();
  }

  /**
   * Get time until token should be refreshed (in milliseconds)
   */
  static getTimeUntilRefresh(): number | null {
    const timeUntilExpiration = this.getTimeUntilExpiration();
    if (timeUntilExpiration === null) return null;

    // Refresh 5 minutes before expiration
    return Math.max(0, timeUntilExpiration - 5 * 60 * 1000);
  }

  /**
   * Check if token needs immediate refresh
   */
  static needsImmediateRefresh(): boolean {
    const token = TokenManager.getAccessToken();
    if (!token) return false;

    return shouldRefreshToken();
  }

  /**
   * Get user role from token
   */
  static getUserRoleFromToken(): string | null {
    const token = TokenManager.getAccessToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || payload.user_type || null;
    } catch (error) {
      console.error('Error parsing token for role:', error);
      return null;
    }
  }

  /**
   * Get user ID from token
   */
  static getUserIdFromToken(): string | null {
    const token = TokenManager.getAccessToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.user_id || payload.id || null;
    } catch (error) {
      console.error('Error parsing token for user ID:', error);
      return null;
    }
  }

  /**
   * Check if user has specific role
   */
  static hasRole(role: string): boolean {
    const userRole = this.getUserRoleFromToken();
    return userRole === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  static hasAnyRole(roles: string[]): boolean {
    const userRole = this.getUserRoleFromToken();
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Get token payload
   */
  static getTokenPayload(): Record<string, any> | null {
    const token = TokenManager.getAccessToken();
    if (!token) return null;

    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
      console.error('Error parsing token payload:', error);
      return null;
    }
  }

  /**
   * Check if token is close to expiration (within specified minutes)
   */
  static isTokenCloseToExpiration(minutes: number = 5): boolean {
    const timeUntilExpiration = this.getTimeUntilExpiration();
    if (timeUntilExpiration === null) return true;

    return timeUntilExpiration <= minutes * 60 * 1000;
  }

  /**
   * Format time until expiration for display
   */
  static formatTimeUntilExpiration(): string | null {
    const timeUntilExpiration = this.getTimeUntilExpiration();
    if (timeUntilExpiration === null) return null;

    const minutes = Math.floor(timeUntilExpiration / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return 'Less than a minute';
    }
  }

  /**
   * Clear all authentication data
   */
  static clearAuthData(): void {
    TokenManager.clearTokens();
    
    // Clear any auth-related session storage
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('redirectAfterLogin');
      sessionStorage.removeItem('lastAuthCheck');
    }
  }

  /**
   * Get redirect URL after login
   */
  static getRedirectAfterLogin(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('redirectAfterLogin');
    }
    return null;
  }

  /**
   * Clear redirect URL after login
   */
  static clearRedirectAfterLogin(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('redirectAfterLogin');
    }
  }

  /**
   * Set last auth check timestamp
   */
  static setLastAuthCheck(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastAuthCheck', Date.now().toString());
    }
  }

  /**
   * Get time since last auth check (in milliseconds)
   */
  static getTimeSinceLastAuthCheck(): number | null {
    if (typeof window !== 'undefined') {
      const lastCheck = sessionStorage.getItem('lastAuthCheck');
      if (lastCheck) {
        return Date.now() - parseInt(lastCheck, 10);
      }
    }
    return null;
  }

  /**
   * Check if auth check is needed (based on time since last check)
   */
  static shouldCheckAuth(intervalMinutes: number = 5): boolean {
    const timeSinceLastCheck = this.getTimeSinceLastAuthCheck();
    if (timeSinceLastCheck === null) return true;

    return timeSinceLastCheck > intervalMinutes * 60 * 1000;
  }
}