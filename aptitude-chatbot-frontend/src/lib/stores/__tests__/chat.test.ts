import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useChatStore } from '../chat';
import { apiClient } from '../../api/client';
import { Message, Conversation, ChatRequest } from '../../../types';

// Mock the API client
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
    streamRequest: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

describe('ChatStore', () => {
  beforeEach(() => {
    // Clear the store state before each test
    useChatStore.getState().clearAllConversations();
    useChatStore.getState().clearError();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useChatStore.getState();

      expect(state.conversations).toEqual([]);
      expect(state.currentConversationId).toBeNull();
      expect(state.currentConversation).toBeNull();
      expect(state.isStreaming).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.streamingMessage).toBeNull();
      expect(state.connectionStatus).toBe('disconnected');
    });
  });

  describe('Conversation Management', () => {
    it('should create new conversation', () => {
      const { createNewConversation } = useChatStore.getState();

      createNewConversation();

      const state = useChatStore.getState();
      expect(state.conversations).toHaveLength(1);
      expect(state.currentConversation).toBeTruthy();
      expect(state.currentConversationId).toBeTruthy();
      expect(state.currentConversation?.messages).toEqual([]);
    });

    it('should set current conversation', () => {
      const { createNewConversation, setCurrentConversation } =
        useChatStore.getState();

      // Create a conversation first
      createNewConversation();
      const conversationId = useChatStore.getState().currentConversationId!;

      // Clear current conversation
      useChatStore.setState({
        currentConversation: null,
        currentConversationId: null,
      });

      // Set it back
      setCurrentConversation(conversationId);

      const state = useChatStore.getState();
      expect(state.currentConversationId).toBe(conversationId);
      expect(state.currentConversation).toBeTruthy();
    });

    it('should clear current conversation', () => {
      const { createNewConversation, clearCurrentConversation } =
        useChatStore.getState();

      createNewConversation();
      clearCurrentConversation();

      const state = useChatStore.getState();
      expect(state.currentConversation).toBeNull();
      expect(state.currentConversationId).toBeNull();
      expect(state.streamingMessage).toBeNull();
      expect(state.isStreaming).toBe(false);
    });
  });

  describe('Message Management', () => {
    it('should add message to conversation', () => {
      const { createNewConversation, addMessageToConversation } =
        useChatStore.getState();

      createNewConversation();
      const conversationId = useChatStore.getState().currentConversationId!;

      const message: Message = {
        id: 'test-message',
        content: 'Hello',
        role: 'user',
        timestamp: new Date().toISOString(),
      };

      addMessageToConversation(conversationId, message);

      const state = useChatStore.getState();
      expect(state.currentConversation?.messages).toHaveLength(1);
      expect(state.currentConversation?.messages[0]).toEqual(message);
    });

    it('should update streaming message', () => {
      const {
        createNewConversation,
        addMessageToConversation,
        updateStreamingMessage,
      } = useChatStore.getState();

      createNewConversation();
      const conversationId = useChatStore.getState().currentConversationId!;

      const streamingMessage: Message = {
        id: 'streaming-message',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      addMessageToConversation(conversationId, streamingMessage);
      useChatStore.setState({ streamingMessage });

      updateStreamingMessage('Hello world');

      const state = useChatStore.getState();
      expect(state.currentConversation?.messages[0].content).toBe(
        'Hello world'
      );
      expect(state.streamingMessage?.content).toBe('Hello world');
    });

    it('should complete streaming message', () => {
      const {
        createNewConversation,
        addMessageToConversation,
        completeStreamingMessage,
      } = useChatStore.getState();

      createNewConversation();
      const conversationId = useChatStore.getState().currentConversationId!;

      const streamingMessage: Message = {
        id: 'streaming-message',
        content: 'Complete message',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      addMessageToConversation(conversationId, streamingMessage);
      useChatStore.setState({
        streamingMessage,
        isStreaming: true,
      });

      const metadata = { confidence: 0.95 };
      completeStreamingMessage(metadata);

      const state = useChatStore.getState();
      expect(state.currentConversation?.messages[0].isStreaming).toBe(false);
      expect(state.streamingMessage).toBeNull();
      expect(state.isStreaming).toBe(false);
      expect(state.connectionStatus).toBe('disconnected');
    });
  });

  describe('API Integration', () => {
    it('should load conversations from API', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockConversations,
        success: true,
        message: 'Success',
      });

      const { loadConversations } = useChatStore.getState();
      await loadConversations();

      const state = useChatStore.getState();
      expect(state.conversations).toEqual(mockConversations);
      expect(state.isLoading).toBe(false);
      expect(apiClient.get).toHaveBeenCalledWith('/chat/conversations');
    });

    it('should handle API errors when loading conversations', async () => {
      const error = new Error('API Error');
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      const { loadConversations } = useChatStore.getState();
      await loadConversations();

      const state = useChatStore.getState();
      expect(state.error).toBe('API Error');
      expect(state.isLoading).toBe(false);
    });

    it('should delete conversation via API', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({
        data: null,
        success: true,
        message: 'Deleted',
      });

      const { createNewConversation, deleteConversation } =
        useChatStore.getState();

      createNewConversation();
      const conversationId = useChatStore.getState().currentConversationId!;

      await deleteConversation(conversationId);

      const state = useChatStore.getState();
      expect(state.conversations).toHaveLength(0);
      expect(state.currentConversation).toBeNull();
      expect(apiClient.delete).toHaveBeenCalledWith(
        `/chat/conversations/${conversationId}`
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle send message validation errors', async () => {
      const { sendMessage } = useChatStore.getState();

      await expect(sendMessage('')).rejects.toThrow('Message cannot be empty');
      await expect(sendMessage('   ')).rejects.toThrow(
        'Message cannot be empty'
      );
    });

    it('should prevent sending message while streaming', async () => {
      useChatStore.setState({ isStreaming: true });

      const { sendMessage } = useChatStore.getState();

      await expect(sendMessage('Hello')).rejects.toThrow(
        'Cannot send message while streaming'
      );
    });

    it('should clear error', () => {
      useChatStore.setState({ error: 'Test error' });

      const { clearError } = useChatStore.getState();
      clearError();

      const state = useChatStore.getState();
      expect(state.error).toBeNull();
    });

    it('should set streaming error', () => {
      const { setStreamingError } = useChatStore.getState();

      setStreamingError('Streaming failed');

      const state = useChatStore.getState();
      expect(state.error).toBe('Streaming failed');
      expect(state.isStreaming).toBe(false);
      expect(state.streamingMessage).toBeNull();
      expect(state.connectionStatus).toBe('error');
    });
  });

  describe('Retry Functionality', () => {
    it('should retry last message', async () => {
      const { createNewConversation, addMessageToConversation } =
        useChatStore.getState();

      createNewConversation();
      const conversationId = useChatStore.getState().currentConversationId!;

      // Add user message
      const userMessage: Message = {
        id: 'user-msg',
        content: 'Hello',
        role: 'user',
        timestamp: new Date().toISOString(),
      };

      // Add assistant message
      const assistantMessage: Message = {
        id: 'assistant-msg',
        content: 'Hi there',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };

      addMessageToConversation(conversationId, userMessage);
      addMessageToConversation(conversationId, assistantMessage);

      // Mock streaming for retry
      const mockStream = {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                'data: {"type":"chunk","content":"Retry"}\n\n'
              ),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: [DONE]\n\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      };

      vi.mocked(apiClient.streamRequest).mockResolvedValueOnce(
        mockStream as any
      );

      const { retryLastMessage } = useChatStore.getState();
      await retryLastMessage();

      const state = useChatStore.getState();
      // Should have removed assistant message and added new one
      expect(state.currentConversation?.messages.length).toBeGreaterThan(1);
      expect(apiClient.streamRequest).toHaveBeenCalledWith('/chat/stream', {
        message: 'Hello',
        conversation_id: conversationId,
      });
    });

    it('should handle retry with no conversation', async () => {
      const { retryLastMessage } = useChatStore.getState();

      await expect(retryLastMessage()).rejects.toThrow(
        'No conversation to retry'
      );
    });
  });

  describe('Connection Status', () => {
    it('should update connection status during streaming', () => {
      const { setStreamingError } = useChatStore.getState();

      // Test error status
      setStreamingError('Connection failed');
      expect(useChatStore.getState().connectionStatus).toBe('error');

      // Test stop streaming
      useChatStore.getState().stopStreaming();
      expect(useChatStore.getState().connectionStatus).toBe('disconnected');
    });
  });
});
