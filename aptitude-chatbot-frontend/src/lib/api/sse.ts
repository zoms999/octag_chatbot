import { ApiError } from './errors';
import { TokenManager } from '../stores/auth';

export interface SSEOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onOpen?: () => void;
  onError?: (error: Error) => void;
  onRetry?: (attempt: number) => void;
}

export interface SSEMessage {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private options: SSEOptions;
  private retryCount = 0;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(url: string, options: SSEOptions = {}) {
    this.url = url;
    this.options = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Add authentication headers
        const token = TokenManager.getAccessToken();
        const headers: Record<string, string> = {
          ...this.options.headers,
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        // Create EventSource with headers (using polyfill if needed)
        this.eventSource = new EventSource(this.url, {
          headers,
        } as any);

        this.eventSource.onopen = () => {
          this.isConnected = true;
          this.retryCount = 0;
          this.options.onOpen?.();
          resolve();
        };

        this.eventSource.onerror = (event) => {
          this.isConnected = false;
          const error = new Error('SSE connection error');
          this.options.onError?.(error);

          if (this.retryCount < (this.options.retryAttempts || 3)) {
            this.scheduleReconnect();
          } else {
            reject(error);
          }
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message: SSEMessage = {
              type: 'message',
              data: JSON.parse(event.data),
              id: event.lastEventId,
            };
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        // Set up timeout
        if (this.options.timeout) {
          setTimeout(() => {
            if (!this.isConnected) {
              reject(new Error('SSE connection timeout'));
            }
          }, this.options.timeout);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.retryCount++;
    const delay = this.options.retryDelay! * Math.pow(2, this.retryCount - 1);

    this.options.onRetry?.(this.retryCount);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Retry failed, will be handled by the error handler
      });
    }, delay);
  }

  private handleMessage(message: SSEMessage): void {
    const listeners = this.listeners.get(message.type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(message.data);
        } catch (error) {
          console.error('Error in SSE message listener:', error);
        }
      });
    }

    // Also trigger generic message listeners
    const genericListeners = this.listeners.get('*');
    if (genericListeners) {
      genericListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (error) {
          console.error('Error in generic SSE message listener:', error);
        }
      });
    }
  }

  addEventListener(type: string, listener: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Add custom event listener to EventSource if connected
    if (this.eventSource && type !== '*' && type !== 'message') {
      this.eventSource.addEventListener(type, (event: any) => {
        try {
          const message: SSEMessage = {
            type,
            data: JSON.parse(event.data),
            id: event.lastEventId,
          };
          this.handleMessage(message);
        } catch (error) {
          console.error(`Error parsing SSE ${type} event:`, error);
        }
      });
    }
  }

  removeEventListener(type: string, listener: (data: any) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
    this.listeners.clear();
  }

  getConnectionState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.eventSource) {
      return 'disconnected';
    }

    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting';
      case EventSource.OPEN:
        return 'connected';
      case EventSource.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  isConnectionOpen(): boolean {
    return this.isConnected && this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Enhanced streaming client for chat
export class ChatStreamingClient {
  private baseUrl: string;
  private currentStream: SSEClient | null = null;
  private abortController: AbortController | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async streamChatResponse(
    request: any,
    onChunk: (chunk: string) => void,
    onComplete: (metadata?: any) => void,
    onError: (error: Error) => void,
    onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  ): Promise<void> {
    // Clean up any existing stream
    this.stopStreaming();

    this.abortController = new AbortController();

    try {
      const token = TokenManager.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      onConnectionChange?.('connecting');

      const response = await fetch(`${this.baseUrl}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}`,
          response.statusText,
          response.status
        );
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      onConnectionChange?.('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;

            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                onComplete();
                return;
              }

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === 'chunk') {
                  onChunk(parsed.content);
                } else if (parsed.type === 'complete') {
                  onChunk(parsed.content);
                  onComplete(parsed.metadata);
                  return;
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.content);
                }
              } catch (parseError) {
                console.error('Error parsing streaming response:', parseError);
              }
            }
          }
        }

        onComplete();
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      onConnectionChange?.('error');
      
      if (error.name === 'AbortError') {
        // Stream was intentionally stopped
        return;
      }

      onError(error);
    } finally {
      onConnectionChange?.('disconnected');
      this.abortController = null;
    }
  }

  stopStreaming(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.currentStream) {
      this.currentStream.close();
      this.currentStream = null;
    }
  }

  isStreaming(): boolean {
    return this.abortController !== null;
  }
}