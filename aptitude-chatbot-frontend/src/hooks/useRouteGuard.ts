import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '../lib/stores/auth';
import { TokenManager } from '../lib/stores/auth';

export interface RouteGuardOptions {
  requireAuth?: boolean;
  redirectTo?: string;
  allowedRoles?: string[];
  onUnauthorized?: () => void;
}

/**
 * Hook for comprehensive route protection
 */
export function useRouteGuard(options: RouteGuardOptions = {}) {
  const {
    requireAuth = true,
    redirectTo = '/login',
    allowedRoles = [],
    onUnauthorized,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, isRefreshing, checkAuth } =
    useAuthStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Initialize authentication check
  useEffect(() => {
    const initializeAuth = async () => {
      if (!isInitialized) {
        await checkAuth();
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [checkAuth, isInitialized]);

  // Check authorization
  useEffect(() => {
    if (!isInitialized || isLoading || isRefreshing) {
      return;
    }

    let authorized = true;

    // Check authentication requirement
    if (requireAuth && !isAuthenticated) {
      authorized = false;
    }

    // Check role-based authorization
    if (authorized && allowedRoles.length > 0 && user) {
      const userRole = user.type;
      authorized = allowedRoles.includes(userRole);
    }

    setIsAuthorized(authorized);

    // Handle unauthorized access
    if (!authorized) {
      if (onUnauthorized) {
        onUnauthorized();
      } else if (requireAuth && !isAuthenticated) {
        // Store the attempted URL for redirect after login
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('redirectAfterLogin', pathname);
        }
        router.push(redirectTo);
      }
    }
  }, [
    isInitialized,
    isLoading,
    isRefreshing,
    isAuthenticated,
    user,
    requireAuth,
    allowedRoles,
    redirectTo,
    pathname,
    router,
    onUnauthorized,
  ]);

  return {
    isLoading: !isInitialized || isLoading || isRefreshing,
    isAuthenticated,
    isAuthorized,
    user,
    hasValidToken: TokenManager.isTokenValid(),
  };
}

/**
 * Hook for protecting authenticated routes
 */
export function useProtectedRoute(
  options?: Omit<RouteGuardOptions, 'requireAuth'>
) {
  return useRouteGuard({
    ...options,
    requireAuth: true,
  });
}

/**
 * Hook for public routes that redirect authenticated users
 */
export function usePublicRoute(redirectTo: string = '/dashboard') {
  return useRouteGuard({
    requireAuth: false,
    redirectTo,
    onUnauthorized: () => {
      // For public routes, "unauthorized" means the user IS authenticated
      // and should be redirected away from public pages like login
    },
  });
}

/**
 * Hook for role-based route protection
 */
export function useRoleBasedRoute(
  allowedRoles: string[],
  options?: Omit<RouteGuardOptions, 'allowedRoles'>
) {
  return useRouteGuard({
    ...options,
    allowedRoles,
    requireAuth: true,
  });
}
