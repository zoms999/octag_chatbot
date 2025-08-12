'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
  side?: 'left' | 'right';
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  children,
  className,
  side = 'left',
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-background',
        collapsed ? 'w-16' : 'w-64',
        'transition-all duration-300 ease-in-out',
        'hidden md:flex', // Hide on mobile, show on md and up
        className
      )}
    >
      {collapsible && (
        <div className="flex items-center justify-end p-2">
          <button
            onClick={() => onCollapsedChange?.(!collapsed)}
            className="rounded-md p-2 hover:bg-accent"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div
              className={cn(
                'h-4 w-4 transition-transform',
                collapsed ? 'rotate-180' : 'rotate-0'
              )}
            >
              {/* Chevron icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </div>
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </aside>
  );
}
