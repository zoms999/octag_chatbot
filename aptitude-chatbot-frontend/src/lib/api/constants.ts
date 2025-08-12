// API constants and configuration
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },

  // Chat endpoints
  CHAT: {
    MESSAGE: '/chat/message',
    STREAM: '/chat/stream',
    CONVERSATIONS: '/chat/conversations',
    CONVERSATION: (id: string) => `/chat/conversations/${id}`,
  },

  // Test endpoints
  TESTS: {
    RESULTS: '/tests/results',
    RESULT: (id: string) => `/tests/results/${id}`,
    USER_RESULTS: (userId: string) => `/tests/results/user/${userId}`,
  },

  // ETL endpoints
  ETL: {
    START: '/etl/start',
    STATUS: (jobId: string) => `/etl/status/${jobId}`,
    CANCEL: (jobId: string) => `/etl/cancel/${jobId}`,
    JOBS_ACTIVE: '/etl/jobs/active',
    EVENTS: (jobId: string) => `/etl/events/${jobId}`,
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export const RETRY_CONFIG = {
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_BASE_DELAY: 1000,
  DEFAULT_MAX_DELAY: 10000,
  DEFAULT_BACKOFF_FACTOR: 2,
} as const;

export const TIMEOUT_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 120000, // 2 minutes
  STREAM_TIMEOUT: 300000, // 5 minutes
} as const;
