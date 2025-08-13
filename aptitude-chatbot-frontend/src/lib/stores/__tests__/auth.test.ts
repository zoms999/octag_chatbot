import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore, TokenManager } from '../auth';
import { AuthService } from '../../auth/authService';

// Mock AuthService
vi.mock('../../auth/authService', () => ({
  AuthService: {
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('AuthStore', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset store state
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isRefreshing: false,
      refreshTimer: null,
    });
  });

  afterEach(() => {
    // Clear any timers
    const state = useAuthStore.getState();
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
    }
  });

  describe('TokenManager', () => {
    it('should store and retrieve tokens correctly', () => {
      const tokens = {
        access: 'access-token',
        refresh: 'refresh-token',
      };

      TokenManager.setTokens(tokens);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'access_token',
        'access-token'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token'
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'token_timestamp',
        expect.any(String)
      );
    });

    it('should clear tokens correctly', () => {
      TokenManager.clearTokens();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        'access_token'
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'token_timestamp'
      );
    });

    it('should return null when no tokens exist', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);

      expect(TokenManager.getAccessToken()).toBeNull();
      expect(TokenManager.getRefreshToken()).toBeNull();
      expect(TokenManager.getTokens()).toBeNull();
    });
  });

  describe('login', () => {
    it('should login successfully and start token refresh timer', async () => {
      const mockUser = { id: '1', name: 'Test User', type: 'personal' };
      const mockTokens = { access: 'access-token', refresh: 'refresh-token' };
      const mockAuthResponse = { user: mockUser, tokens: mockTokens };

      vi.mocked(AuthService.login).mockResolvedValue(mockAuthResponse);

      const credentials = {
        username: 'test@example.com',
        password: 'password',
        loginType: 'personal' as const,
      };

      await useAuthStore.getState().login(credentials);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.tokens).toEqual(mockTokens);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle login failure', async () => {
      const mockError = new Error('Login failed');
      vi.mocked(AuthService.login).mockRejectedValue(mockError);

      const credentials = {
        username: 'test@example.com',
        password: 'wrong-password',
        loginType: 'personal' as const,
      };

      await expect(useAuthStore.getState().login(credentials)).rejects.toThrow(
        'Login failed'
      );

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Login failed');
    });
  });

  describe('logout', () => {
    it('should logout and clear all data', async () => {
      // Set initial authenticated state
      useAuthStore.setState({
        user: { id: '1', name: 'Test User', type: 'personal' },
        tokens: { access: 'access-token', refresh: 'refresh-token' },
        isAuthenticated: true,
        refreshTimer: setTimeout(() => {}, 1000),
      });

      vi.mocked(AuthService.logout).mockResolvedValue();

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.tokens).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isRefreshing).toBe(false);
      expect(state.refreshTimer).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      mockLocalStorage.getItem.mockReturnValue('old-refresh-token');
      vi.mocked(AuthService.refreshToken).mockResolvedValue(
        mockRefreshResponse
      );

      await useAuthStore.getState().refreshToken();

      const state = useAuthStore.getState();
      expect(state.tokens).toEqual({
        access: 'new-access-token',
        refresh: 'new-refresh-token',
      });
      expect(state.isRefreshing).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle refresh failure and logout', async () => {
      const mockError = new Error('Refresh failed');
      mockLocalStorage.getItem.mockReturnValue('old-refresh-token');
      vi.mocked(AuthService.refreshToken).mockRejectedValue(mockError);

      // Mock logout to avoid actual redirect
      const logoutSpy = vi
        .spyOn(useAuthStore.getState(), 'logout')
        .mockImplementation(async () => {
          useAuthStore.setState({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isRefreshing: false,
          });
        });

      await expect(useAuthStore.getState().refreshToken()).rejects.toThrow(
        'Refresh failed'
      );

      expect(logoutSpy).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous refresh attempts', async () => {
      mockLocalStorage.getItem.mockReturnValue('refresh-token');
      vi.mocked(AuthService.refreshToken).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  access_token: 'new-access-token',
                  refresh_token: 'new-refresh-token',
                }),
              100
            )
          )
      );

      // Start first refresh
      const promise1 = useAuthStore.getState().refreshToken();

      // Start second refresh immediately
      const promise2 = useAuthStore.getState().refreshToken();

      await Promise.all([promise1, promise2]);

      // Should only call the service once
      expect(AuthService.refreshToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkAuth', () => {
    it('should check auth successfully with valid tokens', async () => {
      const mockUser = { id: '1', name: 'Test User', type: 'personal' };

      mockSessionStorage.getItem.mockReturnValue('valid-token');
      mockLocalStorage.getItem.mockReturnValue('refresh-token');
      vi.mocked(AuthService.getCurrentUser).mockResolvedValue(mockUser);

      // Mock TokenManager.isTokenValid to return true
      vi.spyOn(TokenManager, 'isTokenValid').mockReturnValue(true);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle no tokens', async () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null);

      await useAuthStore.getState().checkAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('token refresh timer', () => {
    it('should start and stop token refresh timer', () => {
      const store = useAuthStore.getState();

      // Mock authenticated state
      useAuthStore.setState({
        isAuthenticated: true,
        tokens: { access: 'token', refresh: 'refresh' },
      });

      mockSessionStorage.getItem.mockReturnValue(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Lp-38GvTuOjaTZ0-OOGgJlp6HcqODGFcpDe5bAW8VvY'
      );

      store.startTokenRefreshTimer();

      const state = useAuthStore.getState();
      expect(state.refreshTimer).not.toBeNull();

      store.stopTokenRefreshTimer();

      const finalState = useAuthStore.getState();
      expect(finalState.refreshTimer).toBeNull();
    });
  });
});
