'use client';

import { useRouter, usePathname } from 'next/navigation';
import { MessageCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DashboardNavigation({
  activeTab,
  onTabChange,
}: DashboardNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleTabClick = (tab: string) => {
    onTabChange(tab);
    router.push(`/${tab}`);
  };

  const tabs = [
    {
      id: 'chat',
      label: '채팅',
      icon: MessageCircle,
      path: '/chat',
    },
    {
      id: 'tests',
      label: '테스트 결과',
      icon: FileText,
      path: '/tests',
    },
  ];

  return (
    <nav className="flex space-x-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname.includes(tab.path);

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
