'use client';

import { useAuthStore } from '../../lib/stores/auth';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';

/**
 * Demo component to show auth system functionality
 * This is for testing purposes only
 */
export function AuthDemo() {
  const { user, isAuthenticated, isLoading, error, logout, clearError } =
    useAuthStore();

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Checking authentication...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Authentication Status</CardTitle>
        <CardDescription>Current authentication state</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={clearError}
              className="mt-2"
            >
              Clear Error
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <p>
            <strong>Status:</strong>{' '}
            <span
              className={isAuthenticated ? 'text-green-600' : 'text-red-600'}
            >
              {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </p>

          {user && (
            <>
              <p>
                <strong>User ID:</strong> {user.id}
              </p>
              <p>
                <strong>Name:</strong> {user.name}
              </p>
              <p>
                <strong>Type:</strong> {user.type}
              </p>
              <p>
                <strong>AC ID:</strong> {user.ac_id}
              </p>
            </>
          )}
        </div>

        {isAuthenticated && (
          <Button onClick={logout} variant="destructive" className="w-full">
            Logout
          </Button>
        )}

        {!isAuthenticated && (
          <p className="text-sm text-muted-foreground">
            Use the login form to authenticate
          </p>
        )}
      </CardContent>
    </Card>
  );
}
