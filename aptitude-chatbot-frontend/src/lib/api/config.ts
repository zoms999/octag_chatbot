import { TIMEOUT_CONFIG, RETRY_CONFIG } from './constants';

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  auth: {
    tokenStorageKey: string;
    refreshTokenStorageKey: string;
    autoRefresh: boolean;
  };
  streaming: {
    timeout: number;
    reconnectAttempts: number;
    reconnectDelay: number;
  };
}

export const defaultApiConfig: ApiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  timeout: TIMEOUT_CONFIG.DEFAULT_TIMEOUT,
  retries: {
    maxRetries: RETRY_CONFIG.DEFAULT_MAX_RETRIES,
    baseDelay: RETRY_CONFIG.DEFAULT_BASE_DELAY,
    maxDelay: RETRY_CONFIG.DEFAULT_MAX_DELAY,
    backoffFactor: RETRY_CONFIG.DEFAULT_BACKOFF_FACTOR,
  },
  auth: {
    tokenStorageKey: 'access_token',
    refreshTokenStorageKey: 'refresh_token',
    autoRefresh: true,
  },
  streaming: {
    timeout: TIMEOUT_CONFIG.STREAM_TIMEOUT,
    reconnectAttempts: 3,
    reconnectDelay: 2000,
  },
};

// Environment-specific configurations
export const getApiConfig = (): ApiConfig => {
  const env = process.env.NODE_ENV;

  switch (env) {
    case 'development':
      return {
        ...defaultApiConfig,
        baseURL:
          process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
      };

    case 'production':
      return {
        ...defaultApiConfig,
        baseURL:
          process.env.NEXT_PUBLIC_API_BASE_URL ||
          'https://api.aptitude-chatbot.com',
        timeout: 60000, // Longer timeout for production
      };

    case 'test':
      return {
        ...defaultApiConfig,
        baseURL: 'http://localhost:8000',
        timeout: 5000, // Shorter timeout for tests
        retries: {
          ...defaultApiConfig.retries,
          maxRetries: 1, // Fewer retries in tests
        },
      };

    default:
      return defaultApiConfig;
  }
};
