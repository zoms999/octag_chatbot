import { apiClient } from './client';
import {
  ChatRequest,
  ChatResponse,
  Conversation,
  StreamingChatResponse,
} from '../../types';

export class ChatApi {
  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await apiClient.post<ChatResponse>(
      '/chat/message',
      request
    );
    return response.data;
  }

  async streamMessage(request: ChatRequest): Promise<ReadableStream> {
    return apiClient.streamRequest('/chat/stream', request);
  }

  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<Conversation[]>('/chat/conversations');
    return response.data;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await apiClient.get<Conversation>(
      `/chat/conversations/${conversationId}`
    );
    return response.data;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/chat/conversations/${conversationId}`);
  }

  async clearAllConversations(): Promise<void> {
    await apiClient.delete('/chat/conversations');
  }

  // Helper method to parse streaming response
  async *parseStreamingResponse(
    stream: ReadableStream
  ): AsyncGenerator<StreamingChatResponse> {
    const reader = stream.getReader();
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
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);

            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed: StreamingChatResponse = JSON.parse(data);
              yield parsed;
            } catch (error) {
              console.warn('Failed to parse streaming response:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const chatApi = new ChatApi();
