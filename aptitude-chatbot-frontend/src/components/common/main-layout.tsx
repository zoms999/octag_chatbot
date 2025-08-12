'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AppLayout } from './app-layout';
import { Header } from './header';
import { Sidebar } from './sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  showSidebar?: boolean;
  sidebarCollapsible?: boolean;
}

export function MainLayout({
  children,
  className,
  header,
  sidebar,
  showSidebar = false,
  sidebarCollapsible = false,
}: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <AppLayout className={className}>
      {header && <Header>{header}</Header>}
      <div className="flex h-[calc(100vh-3.5rem)]">
        {' '}
        {/* Subtract header height */}
        {showSidebar && sidebar && (
          <Sidebar
            collapsible={sidebarCollapsible}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          >
            {sidebar}
          </Sidebar>
        )}
        <main
          className={cn('flex-1 overflow-auto', showSidebar ? 'md:ml-0' : '')}
        >
          {children}
        </main>
      </div>
    </AppLayout>
  );
}
