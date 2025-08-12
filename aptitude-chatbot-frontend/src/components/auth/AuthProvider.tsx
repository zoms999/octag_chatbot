'use client';

import { useEffect, ReactNode } from 'react';
import { useAuthStore } from '../../lib/stores/auth';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Auth provider that initializes authentication state on app load
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    // Check authentication status when the app loads
    checkAuth();
  }, [checkAuth]);

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
