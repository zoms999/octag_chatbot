'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isStreaming?: boolean;
  isLoading?: boolean;
  onStopStreaming?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  onSendMessage,
  isStreaming = false,
  isLoading = false,
  onStopStreaming,
  disabled = false,
  placeholder = '메시지를 입력하세요...',
  className,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || isStreaming || isLoading || disabled) {
      return;
    }

    onSendMessage(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStop = () => {
    if (onStopStreaming) {
      onStopStreaming();
    }
  };

  // Focus input when not streaming
  useEffect(() => {
    if (!isStreaming && !isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isStreaming, isLoading]);

  const isInputDisabled = disabled || isLoading;
  const canSend = message.trim() && !isInputDisabled && !isStreaming;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex items-center gap-2 p-4 border-t bg-background',
        className
      )}
    >
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isInputDisabled}
          className="pr-12"
        />

        {isStreaming && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleStop}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Button
        type="submit"
        disabled={!canSend}
        size="sm"
        className={cn(
          'h-10 w-10 p-0',
          canSend && 'bg-primary hover:bg-primary/90'
        )}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
