// Chat related types
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentReference {
  id: string;
  title: string;
  type: string;
  relevanceScore: number;
  snippet: string;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  retrieved_documents: DocumentReference[];
  confidence_score: number;
  processing_time: number;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface StreamingChatResponse {
  type: 'chunk' | 'complete' | 'error';
  content: string;
  conversation_id?: string;
  metadata?: {
    retrieved_documents?: DocumentReference[];
    confidence_score?: number;
    processing_time?: number;
  };
}
