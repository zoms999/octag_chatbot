# Aptitude Chatbot Frontend

A Next.js 14 frontend application for an AI-powered aptitude test chatbot system.

## Features

- 🔐 JWT-based authentication (personal/organization users)
- 💬 Real-time AI chat with streaming responses
- 📊 Test results management and monitoring
- 🎨 Modern UI with shadcn/ui and Tailwind CSS
- 📱 Responsive design for all devices
- ♿ Accessibility-first approach
- 🌙 Dark/Light theme support

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Real-time**: Server-Sent Events (SSE)

## Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env.local
   ```

   Update the values in `.env.local` according to your backend configuration.

3. **Run the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main application pages
│   └── api/               # API route handlers
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── auth/             # Authentication components
│   ├── chat/             # Chat-related components
│   ├── tests/            # Test results components
│   └── common/           # Shared components
├── lib/                  # Utilities and configurations
│   ├── api/              # API client setup
│   ├── auth/             # Authentication logic
│   ├── stores/           # Zustand stores
│   └── utils/            # Utility functions
├── types/                # TypeScript type definitions
└── hooks/                # Custom React hooks
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Environment Variables

| Variable                   | Description                     | Default                 |
| -------------------------- | ------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL                 | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL`       | WebSocket URL                   | `ws://localhost:8000`   |
| `JWT_SECRET_KEY`           | JWT secret for token validation | -                       |
| `ADMIN_TOKEN`              | Admin authentication token      | -                       |

## Development Guidelines

- Follow TypeScript strict mode
- Use ESLint and Prettier for code quality
- Implement responsive design patterns
- Ensure accessibility compliance
- Write meaningful commit messages
- Test components before committing
