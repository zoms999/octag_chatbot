'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNavigation } from './DashboardNavigation';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(() => {
    if (pathname.includes('/chat')) return 'chat';
    if (pathname.includes('/tests')) return 'tests';
    return 'chat'; // default
  });

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <DashboardNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
        <main className={cn('flex-1')}>{children}</main>
      </div>
    </div>
  );
}
