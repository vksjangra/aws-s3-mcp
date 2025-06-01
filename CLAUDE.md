# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Running
```bash
npm run build           # Compile TypeScript to dist/
npm start              # Run the compiled MCP server
node dist/index.js     # Direct execution (equivalent to npm start)
```

### Testing
```bash
npm test               # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

### Code Quality
```bash
npm run lint           # Lint code with Biome
npm run format         # Format code with Biome
npm run check:format   # Check formatting without modifying files
```

### Docker Development
```bash
npm run docker:build  # Build Docker image
npm run docker:run    # Run container locally
docker compose up -d   # Start with MinIO for testing
sh run-inspector.sh    # Debug with MCP Inspector
```

## Architecture Overview

This is an AWS S3 Model Context Protocol (MCP) server that enables LLMs to interact with S3 storage through standardized tools.

### Core Components

**Entry Point (`src/index.ts`)**
- Creates McpServer instance with stdio transport
- Registers all S3 tools using the tool factory pattern
- Handles CLI arguments and environment configuration

**S3 Resource Layer (`src/resources/s3.ts`)**
- Centralized AWS S3 client management and configuration
- Handles bucket access validation and filtering based on S3_BUCKETS env var
- Provides core S3 operations (list buckets, list objects, get object)

**Tools Layer (`src/tools/`)**
- Individual MCP tools that implement the IMCPTool interface
- Each tool (ListBuckets, ListObjects, GetObject) wraps S3Resource operations
- Tools are registered via the factory pattern in `src/tools/index.ts`

**Type System (`src/types.ts`)**
- Defines IMCPTool interface for consistent tool implementation
- Common type definitions for S3 operations and responses

### Key Design Patterns

- **Factory Pattern**: Tools are created through `createTools()` function
- **Resource Abstraction**: S3Resource provides a clean interface over AWS SDK
- **Environment-based Configuration**: Bucket access controlled via S3_BUCKETS env var
- **Tool Interface**: All tools implement IMCPTool for consistency

### Environment Variables

The server uses these key environment variables:
- `S3_BUCKETS`: Comma-separated list of allowed buckets (security control)
- `AWS_REGION`: AWS region for S3 operations
- `S3_MAX_BUCKETS`: Limits bucket listing results

### Testing Setup

Tests use Vitest with mocked AWS SDK clients. Integration tests can run against MinIO using Docker Compose for local S3-compatible testing.