import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../lib/stores/auth';
import { TokenManager } from '../lib/stores/auth';
import { shouldRefreshToken, isTokenExpired } from '../lib/auth/tokenRefresh';

/**
 * Hook for automatic token refresh management
 */
export function useTokenRefresh() {
  const {
    isAuthenticated,
    isRefreshing,
    refreshToken,
    logout,
    startTokenRefreshTimer,
    stopTokenRefreshTimer,
  } = useAuthStore();

  const checkAndRefreshToken = useCallback(async () => {
    if (!isAuthenticated || isRefreshing) {
      return;
    }

    const token = TokenManager.getAccessToken();
    if (!token) {
      return;
    }

    // If token is expired, logout
    if (isTokenExpired()) {
      logout();
      return;
    }

    // If token should be refreshed, refresh it
    if (shouldRefreshToken()) {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Auto token refresh failed:', error);
        logout();
      }
    }
  }, [isAuthenticated, isRefreshing, refreshToken, logout]);

  // Set up periodic token check
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Check immediately
    checkAndRefreshToken();

    // Set up interval to check every minute
    const interval = setInterval(checkAndRefreshToken, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, checkAndRefreshToken]);

  // Start/stop token refresh timer based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      startTokenRefreshTimer();
    } else {
      stopTokenRefreshTimer();
    }

    return () => {
      stopTokenRefreshTimer();
    };
  }, [isAuthenticated, startTokenRefreshTimer, stopTokenRefreshTimer]);

  // Handle page visibility change to refresh token when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        checkAndRefreshToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, checkAndRefreshToken]);

  return {
    isRefreshing,
    checkAndRefreshToken,
  };
}
