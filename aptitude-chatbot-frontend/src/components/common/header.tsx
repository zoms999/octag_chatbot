'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Container } from './app-layout';
import { ThemeToggle } from './theme-toggle';

interface HeaderProps {
  children?: React.ReactNode;
  className?: string;
  showThemeToggle?: boolean;
}

export function Header({
  children,
  className,
  showThemeToggle = true,
}: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <Container>
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">{children}</div>
          {showThemeToggle && (
            <div className="flex items-center space-x-2">
              <ThemeToggle />
            </div>
          )}
        </div>
      </Container>
    </header>
  );
}
