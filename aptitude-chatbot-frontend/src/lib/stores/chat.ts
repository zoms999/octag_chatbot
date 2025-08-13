import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Message,
  Conversation,
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  DocumentReference,
} from '../../types';
import { apiClient } from '../api/client';
import { ChatStreamingClient } from '../api/sse';
import { getNetworkMonitor, NetworkStatus } from '../api/networkMonitor';
import { v4 as uuidv4 } from 'uuid';

interface ChatState {
  // State
  conversations: Conversation[];
  currentConversationId: string | null;
  currentConversation: Conversation | null;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  streamingMessage: Message | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  networkStatus: NetworkStatus | null;
  retryAttempts: number;
  maxRetryAttempts: number;

  // Actions
  sendMessage: (message: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  createNewConversation: () => void;
  setCurrentConversation: (conversationId: string | null) => void;
  clearCurrentConversation: () => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearAllConversations: () => Promise<void>;
  retryLastMessage: () => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
  initializeNetworkMonitoring: () => void;
  destroyNetworkMonitoring: () => void;

  // Internal methods
  streamChatResponse: (request: ChatRequest) => Promise<void>;
  addMessageToConversation: (conversationId: string, message: Message) => void;
  updateStreamingMessage: (content: string) => void;
  completeStreamingMessage: (metadata?: any) => void;
  setStreamingError: (error: string) => void;
  handleNetworkStatusChange: (status: NetworkStatus) => void;
}

// Utility functions
const createMessage = (
  content: string,
  role: 'user' | 'assistant',
  isStreaming = false
): Message => ({
  id: uuidv4(),
  content,
  role,
  timestamp: new Date().toISOString(),
  isStreaming,
});

const createConversation = (initialMessage?: Message): Conversation => ({
  id: uuidv4(),
  messages: initialMessage ? [initialMessage] : [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Create streaming client instance
let streamingClient: ChatStreamingClient | null = null;
const getStreamingClient = () => {
  if (!streamingClient) {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
    streamingClient = new ChatStreamingClient(baseUrl);
  }
  return streamingClient;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      currentConversationId: null,
      currentConversation: null,
      isStreaming: false,
      isLoading: false,
      error: null,
      streamingMessage: null,
      connectionStatus: 'disconnected',
      networkStatus: null,
      retryAttempts: 0,
      maxRetryAttempts: 3,

      // Send message action
      sendMessage: async (message: string) => {
        const state = get();

        if (state.isStreaming) {
          throw new Error('Cannot send message while streaming');
        }

        if (!message.trim()) {
          throw new Error('Message cannot be empty');
        }

        // Check network status
        if (state.networkStatus && !state.networkStatus.isOnline) {
          throw new Error('네트워크 연결을 확인해주세요.');
        }

        set({ isLoading: true, error: null, retryAttempts: 0 });

        try {
          // Create user message
          const userMessage = createMessage(message, 'user');

          // Get or create conversation
          let conversationId = state.currentConversationId;
          let conversation = state.currentConversation;

          if (!conversation) {
            conversation = createConversation(userMessage);
            conversationId = conversation.id;

            set((state) => ({
              conversations: [...state.conversations, conversation!],
              currentConversationId: conversationId,
              currentConversation: conversation,
            }));
          } else {
            // Add user message to existing conversation
            get().addMessageToConversation(conversationId!, userMessage);
          }

          // Create streaming assistant message
          const assistantMessage = createMessage('', 'assistant', true);
          get().addMessageToConversation(conversationId!, assistantMessage);

          set({
            streamingMessage: assistantMessage,
            isStreaming: true,
            isLoading: false,
            connectionStatus: 'connecting',
          });

          // Send request to API
          const chatRequest: ChatRequest = {
            message,
            conversation_id: conversationId || undefined,
          };

          // Use streaming API
          await get().streamChatResponse(chatRequest);
        } catch (error: any) {
          console.error('Send message error:', error);
          const errorMessage = error.message || 'Failed to send message';

          set({
            error: errorMessage,
            isLoading: false,
            isStreaming: false,
            streamingMessage: null,
            connectionStatus: 'error',
          });

          throw error;
        }
      },

      // Stream chat response (internal method)
      streamChatResponse: async (request: ChatRequest) => {
        const state = get();
        let fullContent = '';

        try {
          const client = getStreamingClient();

          await client.streamChatResponse(
            request,
            // onChunk
            (chunk: string) => {
              fullContent += chunk;
              get().updateStreamingMessage(fullContent);
            },
            // onComplete
            (metadata?: any) => {
              get().completeStreamingMessage(metadata);
              set({ retryAttempts: 0 }); // Reset retry count on success
            },
            // onError
            (error: Error) => {
              console.error('Streaming error:', error);
              
              const state = get();
              const shouldRetry = state.retryAttempts < state.maxRetryAttempts && 
                                 state.networkStatus?.isOnline !== false;

              if (shouldRetry) {
                // Retry with exponential backoff
                const delay = Math.pow(2, state.retryAttempts) * 1000;
                set({ retryAttempts: state.retryAttempts + 1 });

                setTimeout(() => {
                  get().streamChatResponse(request);
                }, delay);
              } else {
                get().setStreamingError(error.message || 'Streaming failed');
              }
            },
            // onConnectionChange
            (status) => {
              set({ connectionStatus: status });
            }
          );
        } catch (error: any) {
          console.error('Failed to start streaming:', error);
          get().setStreamingError(error.message || 'Failed to start streaming');
        }
      },

      // Load conversations from API
      loadConversations: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<Conversation[]>(
            '/chat/conversations'
          );

          set({
            conversations: response.data || [],
            isLoading: false,
          });
        } catch (error: any) {
          console.error('Load conversations error:', error);
          set({
            error: error.message || 'Failed to load conversations',
            isLoading: false,
          });
        }
      },

      // Load specific conversation
      loadConversation: async (conversationId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.get<Conversation>(
            `/chat/conversations/${conversationId}`
          );
          const conversation = response.data;

          if (conversation) {
            set((state) => ({
              conversations: state.conversations.map((c) =>
                c.id === conversationId ? conversation : c
              ),
              currentConversation: conversation,
              currentConversationId: conversationId,
              isLoading: false,
            }));
          }
        } catch (error: any) {
          console.error('Load conversation error:', error);
          set({
            error: error.message || 'Failed to load conversation',
            isLoading: false,
          });
        }
      },

      // Create new conversation
      createNewConversation: () => {
        const newConversation = createConversation();

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversation: newConversation,
          currentConversationId: newConversation.id,
          error: null,
        }));
      },

      // Set current conversation
      setCurrentConversation: (conversationId: string | null) => {
        if (!conversationId) {
          set({
            currentConversation: null,
            currentConversationId: null,
          });
          return;
        }

        const state = get();
        const conversation = state.conversations.find(
          (c) => c.id === conversationId
        );

        if (conversation) {
          set({
            currentConversation: conversation,
            currentConversationId: conversationId,
            error: null,
          });
        } else {
          // Load conversation from API if not found locally
          get().loadConversation(conversationId);
        }
      },

      // Clear current conversation
      clearCurrentConversation: () => {
        set({
          currentConversation: null,
          currentConversationId: null,
          streamingMessage: null,
          isStreaming: false,
          error: null,
        });
      },

      // Delete conversation
      deleteConversation: async (conversationId: string) => {
        try {
          await apiClient.delete(`/chat/conversations/${conversationId}`);

          set((state) => ({
            conversations: state.conversations.filter(
              (c) => c.id !== conversationId
            ),
            currentConversation:
              state.currentConversationId === conversationId
                ? null
                : state.currentConversation,
            currentConversationId:
              state.currentConversationId === conversationId
                ? null
                : state.currentConversationId,
          }));
        } catch (error: any) {
          console.error('Delete conversation error:', error);
          set({ error: error.message || 'Failed to delete conversation' });
          throw error;
        }
      },

      // Clear all conversations
      clearAllConversations: async () => {
        try {
          await apiClient.delete('/chat/conversations');

          set({
            conversations: [],
            currentConversation: null,
            currentConversationId: null,
            streamingMessage: null,
            isStreaming: false,
            error: null,
          });
        } catch (error: any) {
          console.error('Clear conversations error:', error);
          set({ error: error.message || 'Failed to clear conversations' });
          throw error;
        }
      },

      // Retry last message
      retryLastMessage: async () => {
        const state = get();
        const conversation = state.currentConversation;

        if (!conversation || conversation.messages.length === 0) {
          throw new Error('No conversation to retry');
        }

        // Find the last user message
        const lastUserMessage = [...conversation.messages]
          .reverse()
          .find((m) => m.role === 'user');

        if (!lastUserMessage) {
          throw new Error('No user message to retry');
        }

        // Remove any assistant messages after the last user message
        const userMessageIndex = conversation.messages.findIndex(
          (m) => m.id === lastUserMessage.id
        );
        const messagesToKeep = conversation.messages.slice(
          0,
          userMessageIndex + 1
        );

        set((state) => ({
          currentConversation: {
            ...conversation,
            messages: messagesToKeep,
            updatedAt: new Date().toISOString(),
          },
          conversations: state.conversations.map((c) =>
            c.id === conversation.id
              ? { ...conversation, messages: messagesToKeep }
              : c
          ),
        }));

        // Resend the message
        await get().sendMessage(lastUserMessage.content);
      },

      // Stop streaming
      stopStreaming: () => {
        const client = getStreamingClient();
        client.stopStreaming();
        
        set({
          isStreaming: false,
          streamingMessage: null,
          connectionStatus: 'disconnected',
          retryAttempts: 0,
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Initialize network monitoring
      initializeNetworkMonitoring: () => {
        const networkMonitor = getNetworkMonitor({
          onStatusChange: get().handleNetworkStatusChange,
          onOffline: () => {
            set({ 
              connectionStatus: 'error',
              error: '네트워크 연결이 끊어졌습니다. 연결을 확인해주세요.'
            });
          },
          onOnline: () => {
            const state = get();
            if (state.error?.includes('네트워크')) {
              set({ error: null });
            }
          },
        });

        set({ networkStatus: networkMonitor.getStatus() });
      },

      // Destroy network monitoring
      destroyNetworkMonitoring: () => {
        // Network monitor cleanup is handled by the singleton
      },

      // Handle network status changes
      handleNetworkStatusChange: (status: NetworkStatus) => {
        set({ networkStatus: status });

        // If we're offline and streaming, stop streaming
        if (!status.isOnline && get().isStreaming) {
          get().stopStreaming();
          set({ 
            error: '네트워크 연결이 끊어져 스트리밍이 중단되었습니다.',
            connectionStatus: 'error'
          });
        }

        // If we're back online and had a network error, clear it
        if (status.isOnline && get().error?.includes('네트워크')) {
          set({ error: null });
        }
      },

      // Add message to conversation (internal)
      addMessageToConversation: (conversationId: string, message: Message) => {
        set((state) => {
          const updatedConversations = state.conversations.map(
            (conversation) => {
              if (conversation.id === conversationId) {
                const updatedConversation = {
                  ...conversation,
                  messages: [...conversation.messages, message],
                  updatedAt: new Date().toISOString(),
                };
                return updatedConversation;
              }
              return conversation;
            }
          );

          const currentConversation =
            state.currentConversationId === conversationId
              ? updatedConversations.find((c) => c.id === conversationId) ||
                null
              : state.currentConversation;

          return {
            conversations: updatedConversations,
            currentConversation,
          };
        });
      },

      // Update streaming message (internal)
      updateStreamingMessage: (content: string) => {
        const state = get();
        if (!state.streamingMessage || !state.currentConversationId) return;

        const updatedMessage = {
          ...state.streamingMessage,
          content,
        };

        set((state) => {
          const updatedConversations = state.conversations.map(
            (conversation) => {
              if (conversation.id === state.currentConversationId) {
                return {
                  ...conversation,
                  messages: conversation.messages.map((msg) =>
                    msg.id === state.streamingMessage?.id ? updatedMessage : msg
                  ),
                  updatedAt: new Date().toISOString(),
                };
              }
              return conversation;
            }
          );

          return {
            conversations: updatedConversations,
            currentConversation:
              updatedConversations.find(
                (c) => c.id === state.currentConversationId
              ) || null,
            streamingMessage: updatedMessage,
          };
        });
      },

      // Complete streaming message (internal)
      completeStreamingMessage: (metadata?: any) => {
        const state = get();
        if (!state.streamingMessage || !state.currentConversationId) return;

        const completedMessage = {
          ...state.streamingMessage,
          isStreaming: false,
          metadata,
        };

        set((state) => {
          const updatedConversations = state.conversations.map(
            (conversation) => {
              if (conversation.id === state.currentConversationId) {
                return {
                  ...conversation,
                  messages: conversation.messages.map((msg) =>
                    msg.id === state.streamingMessage?.id
                      ? completedMessage
                      : msg
                  ),
                  updatedAt: new Date().toISOString(),
                };
              }
              return conversation;
            }
          );

          return {
            conversations: updatedConversations,
            currentConversation:
              updatedConversations.find(
                (c) => c.id === state.currentConversationId
              ) || null,
            streamingMessage: null,
            isStreaming: false,
            connectionStatus: 'disconnected',
          };
        });
      },

      // Set streaming error (internal)
      setStreamingError: (error: string) => {
        set({
          error,
          isStreaming: false,
          streamingMessage: null,
          connectionStatus: 'error',
        });
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist conversations and current conversation ID
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
