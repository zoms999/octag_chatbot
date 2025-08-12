import { TokenManager } from '../stores/auth';

/**
 * Utility to check if token needs refresh
 */
export function shouldRefreshToken(): boolean {
  const token = TokenManager.getAccessToken();
  if (!token) return false;

  try {
    // Decode JWT token to check expiration
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);

    // Refresh if token expires in the next 5 minutes
    return payload.exp - currentTime < 300;
  } catch (error) {
    console.error('Error parsing token:', error);
    return true; // If we can't parse, assume we need to refresh
  }
}

/**
 * Utility to check if token is expired
 */
export function isTokenExpired(): boolean {
  const token = TokenManager.getAccessToken();
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);

    return payload.exp <= currentTime;
  } catch (error) {
    console.error('Error parsing token:', error);
    return true;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(): Date | null {
  const token = TokenManager.getAccessToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return new Date(payload.exp * 1000);
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
}
