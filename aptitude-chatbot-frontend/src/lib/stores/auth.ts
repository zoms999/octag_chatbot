import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, LoginCredentials, AuthTokens } from '../../types';
import { AuthService } from '../auth/authService';
import { shouldRefreshToken, isTokenExpired } from '../auth/tokenRefresh';

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isRefreshing: boolean;
  refreshTimer: NodeJS.Timeout | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User) => void;
  startTokenRefreshTimer: () => void;
  stopTokenRefreshTimer: () => void;
  scheduleTokenRefresh: () => void;
}

// Token storage utilities (for future use)
// const TOKEN_STORAGE_KEY = 'auth_tokens';
// const USER_STORAGE_KEY = 'auth_user';

class TokenManager {
  static setTokens(tokens: AuthTokens): void {
    if (typeof window !== 'undefined') {
      // Store access token in memory for security
      sessionStorage.setItem('access_token', tokens.access);
      // Store refresh token in localStorage for persistence
      localStorage.setItem('refresh_token', tokens.refresh);

      // Store token timestamp for expiration tracking
      localStorage.setItem('token_timestamp', Date.now().toString());
    }
  }

  static getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('access_token');
    }
    return null;
  }

  static getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  static clearTokens(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_timestamp');
    }
  }

  static getTokens(): AuthTokens | null {
    const access = this.getAccessToken();
    const refresh = this.getRefreshToken();

    if (access && refresh) {
      return { access, refresh };
    }
    return null;
  }

  static getTokenTimestamp(): number | null {
    if (typeof window !== 'undefined') {
      const timestamp = localStorage.getItem('token_timestamp');
      return timestamp ? parseInt(timestamp, 10) : null;
    }
    return null;
  }

  static isTokenValid(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    return !isTokenExpired();
  }

  static shouldRefresh(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    return shouldRefreshToken();
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isRefreshing: false,
      refreshTimer: null,

      // Login action
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const authResponse = await AuthService.login(credentials);
          const { user, tokens } = authResponse;

          // Store tokens securely
          TokenManager.setTokens(tokens);

          set({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Start automatic token refresh
          get().startTokenRefreshTimer();
        } catch (error: unknown) {
          const errorMessage =
            (error as any).response?.data?.message ||
            (error as any).message ||
            'Login failed';
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Logout action
      logout: async () => {
        // Stop token refresh timer
        get().stopTokenRefreshTimer();

        try {
          await AuthService.logout();
        } catch (error) {
          console.warn('Server logout failed:', error);
        }

        TokenManager.clearTokens();
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          isRefreshing: false,
          refreshTimer: null,
        });

        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      },

      // Refresh token action
      refreshToken: async () => {
        const state = get();

        // Prevent multiple simultaneous refresh attempts
        if (state.isRefreshing) {
          return;
        }

        const refreshToken = TokenManager.getRefreshToken();

        if (!refreshToken) {
          get().logout();
          throw new Error('No refresh token available');
        }

        set({ isRefreshing: true });

        try {
          const response = await AuthService.refreshToken(refreshToken);
          const newTokens: AuthTokens = {
            access: response.access_token,
            refresh: response.refresh_token || refreshToken,
          };

          TokenManager.setTokens(newTokens);
          set({
            tokens: newTokens,
            isRefreshing: false,
            error: null,
          });

          // Schedule next refresh
          get().scheduleTokenRefresh();
        } catch (error: unknown) {
          console.error('Token refresh failed:', error);
          set({ isRefreshing: false });
          get().logout();
          throw error;
        }
      },

      // Check authentication status
      checkAuth: async () => {
        set({ isLoading: true });

        try {
          const tokens = TokenManager.getTokens();

          if (!tokens) {
            set({ isLoading: false, isAuthenticated: false });
            return;
          }

          // Check if token is expired
          if (!TokenManager.isTokenValid()) {
            // Try to refresh token
            try {
              await get().refreshToken();
            } catch {
              set({ isLoading: false, isAuthenticated: false });
              return;
            }
          }

          // Verify token with backend
          const user = await AuthService.getCurrentUser();

          set({
            user,
            tokens: TokenManager.getTokens(),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // Start token refresh timer if not already running
          get().startTokenRefreshTimer();
        } catch (error: unknown) {
          console.error('Auth check failed:', error);
          // Try to refresh token once
          try {
            await get().refreshToken();
            const user = await AuthService.getCurrentUser();
            set({
              user,
              tokens: TokenManager.getTokens(),
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            get().startTokenRefreshTimer();
          } catch {
            get().logout();
          }
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Set tokens (for external use)
      setTokens: (tokens: AuthTokens) => {
        TokenManager.setTokens(tokens);
        set({ tokens, isAuthenticated: true });
        get().startTokenRefreshTimer();
      },

      // Set user (for external use)
      setUser: (user: User) => {
        set({ user });
      },

      // Start token refresh timer
      startTokenRefreshTimer: () => {
        const state = get();

        // Clear existing timer
        if (state.refreshTimer) {
          clearTimeout(state.refreshTimer);
        }

        // Don't start timer if not authenticated
        if (!state.isAuthenticated || !TokenManager.getAccessToken()) {
          return;
        }

        // Schedule next refresh check
        get().scheduleTokenRefresh();
      },

      // Stop token refresh timer
      stopTokenRefreshTimer: () => {
        const state = get();
        if (state.refreshTimer) {
          clearTimeout(state.refreshTimer);
          set({ refreshTimer: null });
        }
      },

      // Schedule token refresh based on token expiration
      scheduleTokenRefresh: () => {
        const state = get();

        // Clear existing timer
        if (state.refreshTimer) {
          clearTimeout(state.refreshTimer);
        }

        if (!TokenManager.getAccessToken()) {
          return;
        }

        try {
          const token = TokenManager.getAccessToken();
          if (!token) return;

          // Parse token to get expiration
          const payload = JSON.parse(atob(token.split('.')[1]));
          const currentTime = Math.floor(Date.now() / 1000);
          const expirationTime = payload.exp;

          // Refresh 5 minutes before expiration
          const refreshTime = (expirationTime - currentTime - 300) * 1000;

          // If token expires in less than 5 minutes, refresh immediately
          if (refreshTime <= 0) {
            get()
              .refreshToken()
              .catch(() => {
                // If refresh fails, logout
                get().logout();
              });
            return;
          }

          // Schedule refresh
          const timer = setTimeout(() => {
            get()
              .refreshToken()
              .catch(() => {
                get().logout();
              });
          }, refreshTime);

          set({ refreshTimer: timer });
        } catch (error) {
          console.error('Error scheduling token refresh:', error);
          // If we can't parse the token, try to refresh it
          get()
            .refreshToken()
            .catch(() => {
              get().logout();
            });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist user data, not tokens (for security)
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);

// Export token manager for use in API client
export { TokenManager };
