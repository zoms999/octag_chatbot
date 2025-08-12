import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/stores/auth';

export interface UseAuthOptions {
  redirectTo?: string;
  redirectIfFound?: boolean;
}

/**
 * Hook for handling authentication state and redirects
 */
export function useAuth(options: UseAuthOptions = {}) {
  const { redirectTo = '/login', redirectIfFound = false } = options;

  const router = useRouter();
  const { user, isAuthenticated, isLoading, error, checkAuth, clearError } =
    useAuthStore();

  useEffect(() => {
    // Check authentication status on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Handle redirects based on authentication state
    if (!isLoading) {
      if (isAuthenticated && redirectIfFound) {
        router.push('/dashboard');
      } else if (!isAuthenticated && !redirectIfFound) {
        router.push(redirectTo);
      }
    }
  }, [isAuthenticated, isLoading, redirectTo, redirectIfFound, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    clearError,
  };
}

/**
 * Hook for protecting routes that require authentication
 */
export function useRequireAuth() {
  return useAuth({
    redirectTo: '/login',
    redirectIfFound: false,
  });
}

/**
 * Hook for redirecting authenticated users (e.g., login page)
 */
export function useRedirectIfAuthenticated() {
  return useAuth({
    redirectTo: '/dashboard',
    redirectIfFound: true,
  });
}
