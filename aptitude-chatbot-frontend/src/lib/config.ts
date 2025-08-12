export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET_KEY,
    adminToken: process.env.ADMIN_TOKEN,
  },
  app: {
    name: 'Aptitude Chatbot',
    version: '1.0.0',
  },
} as const;
