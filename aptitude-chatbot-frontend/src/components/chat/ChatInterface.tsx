'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/lib/stores/chat';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatInterfaceProps {
  className?: string;
}

export function ChatInterface({ className }: ChatInterfaceProps) {
  const {
    currentConversation,
    isStreaming,
    isLoading,
    error,
    streamingMessage,
    connectionStatus,
    sendMessage,
    createNewConversation,
    clearCurrentConversation,
    retryLastMessage,
    stopStreaming,
    clearError,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation?.messages, streamingMessage]);

  // Handle sending messages
  const handleSendMessage = async (message: string) => {
    try {
      await sendMessage(message);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.message || '메시지 전송에 실패했습니다');
    }
  };

  // Handle retry
  const handleRetry = async () => {
    try {
      await retryLastMessage();
    } catch (error: any) {
      console.error('Failed to retry message:', error);
      toast.error(error.message || '메시지 재전송에 실패했습니다');
    }
  };

  // Handle clear conversation
  const handleClearConversation = () => {
    clearCurrentConversation();
    toast.success('대화가 초기화되었습니다');
  };

  // Handle new conversation
  const handleNewConversation = () => {
    createNewConversation();
    toast.success('새 대화를 시작합니다');
  };

  // Clear error when component mounts
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

  const messages = currentConversation?.messages || [];
  const hasMessages = messages.length > 0;
  const showTypingIndicator = isLoading && !isStreaming && !streamingMessage;

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="font-semibold">AI 챗봇</h2>
          {connectionStatus === 'connected' && (
            <div className="w-2 h-2 bg-green-500 rounded-full" />
          )}
          {connectionStatus === 'error' && (
            <div className="w-2 h-2 bg-red-500 rounded-full" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isLoading || isStreaming}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              재시도
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleNewConversation}
            disabled={isLoading || isStreaming}
          >
            <MessageSquare className="h-4 w-4 mr-1" />새 대화
          </Button>

          {hasMessages && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearConversation}
              disabled={isLoading || isStreaming}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              초기화
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-0">
          <div className="min-h-full flex flex-col">
            {!hasMessages && !showTypingIndicator && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">
                    AI 챗봇과 대화를 시작하세요
                  </h3>
                  <p className="text-sm">
                    적성검사 결과에 대해 궁금한 것이 있으면 언제든 물어보세요.
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Typing Indicator */}
            {showTypingIndicator && <TypingIndicator />}

            {/* Error Message */}
            {error && (
              <div className="p-4 mx-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="text-destructive hover:text-destructive"
                  >
                    ✕
                  </Button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          isLoading={isLoading}
          onStopStreaming={stopStreaming}
          disabled={!!error}
          placeholder="적성검사 결과에 대해 궁금한 것을 물어보세요..."
        />
      </div>
    </Card>
  );
}
