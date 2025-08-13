'use client';

import { useAuthStore } from '@/lib/stores/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DashboardHeader() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    return user.name || 'User';
  };

  const getUserTypeLabel = () => {
    if (!user) return '';

    switch (user.type) {
      case 'personal':
        return '개인 사용자';
      case 'organization_admin':
        return '기관 관리자';
      case 'organization_member':
        return '기관 구성원';
      default:
        return '';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Title */}
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">적성검사 챗봇</h1>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            {/* User Info */}
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{getUserDisplayName()}</span>
                <span className="text-xs text-muted-foreground">
                  {getUserTypeLabel()}
                </span>
              </div>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>로그아웃</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
