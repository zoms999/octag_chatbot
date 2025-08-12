'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface NavigationProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function Navigation({
  children,
  className,
  orientation = 'horizontal',
}: NavigationProps) {
  return (
    <nav
      className={cn(
        'flex',
        orientation === 'horizontal'
          ? 'flex-row space-x-1'
          : 'flex-col space-y-1',
        className
      )}
    >
      {children}
    </nav>
  );
}

interface NavigationItemProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function NavigationItem({
  children,
  className,
  active = false,
  disabled = false,
  onClick,
}: NavigationItemProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
