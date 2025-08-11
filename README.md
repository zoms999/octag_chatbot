# Aptitude Chatbot RAG System

An intelligent conversational AI system that transforms static aptitude test reports into dynamic, interactive conversations using Retrieval-Augmented Generation (RAG) technology.

## Overview

This system processes aptitude test results into semantic documents optimized for vector search and enables users to have natural language conversations about their personality profiles, thinking skills, and career recommendations.

## Architecture

- **ETL Pipeline**: Transforms raw test data into semantic documents
- **Vector Database**: PostgreSQL with pgvector for similarity search
- **RAG Engine**: Google Gemini for embeddings and response generation
- **API Layer**: FastAPI for REST endpoints and WebSocket support

## Database Setup

### Prerequisites

1. PostgreSQL 14+ with pgvector extension
2. Python 3.9+
3. Required Python packages (see requirements.txt)

### Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Set up database:**
   ```bash
   python scripts/setup_database.py
   ```

### Manual Database Setup

If you prefer to set up the database manually:

1. **Create database:**
   ```sql
   CREATE DATABASE aptitude_chatbot;
   ```

2. **Enable pgvector extension:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. **Run migrations:**
   ```bash
   python database/migration_manager.py migrate
   ```

## Database Schema

### Core Tables

- **chat_users**: User management and test completion tracking
- **chat_documents**: Semantic documents with vector embeddings
- **chat_jobs**: Job information with career matching vectors
- **chat_majors**: Academic major data with similarity vectors
- **chat_conversations**: Chat history and context tracking

### Vector Search

The system uses pgvector with HNSW indexes for efficient similarity search:
- 768-dimensional vectors (Google Gemini embedding size)
- Cosine similarity for document matching
- Optimized for sub-second search performance

## Testing

Run the database setup tests:

```bash
pytest tests/test_database_setup.py -v
```

## Migration Management

Check migration status:
```bash
python database/migration_manager.py status
```

Run pending migrations:
```bash
python database/migration_manager.py migrate
```

Rollback a migration:
```bash
python database/migration_manager.py rollback 001
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_NAME | Database name | aptitude_chatbot |
| DB_USER | Database user | postgres |
| DB_PASSWORD | Database password | (required) |
| DB_POOL_SIZE | Connection pool size | 10 |
| DB_ECHO | Enable SQL logging | false |

## Next Steps

After completing the database setup, you can proceed with:

1. **Task 2**: Implement core data models and validation
2. **Task 3**: Build ETL pipeline foundation
3. **Task 4**: Implement document storage and retrieval system

See the full implementation plan in `.kiro/specs/aptitude-chatbot-rag-system/tasks.md`.