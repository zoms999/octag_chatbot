'use client';

import { ChatInterface } from '@/components/chat';
import { MessageCircle } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center space-x-2">
        <MessageCircle className="h-6 w-6" />
        <h1 className="text-2xl font-bold">채팅</h1>
      </div>

      <div className="flex-1 min-h-0">
        <ChatInterface className="h-full" />
      </div>
    </div>
  );
}
