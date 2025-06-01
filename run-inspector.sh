#!/bin/bash

# Run MCP Inspector for S3 MCP Server
# This script launches the MCP Inspector connected to our S3 MCP server

# Function to show usage
show_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  -dc, --docker-compose  Run using Docker Compose with MinIO"
  echo "  -d, --docker           Run using Docker CLI (without Docker Compose)"
  echo "  --http                 Use HTTP transport (default for local mode)"
  echo "  --stdio                Use STDIO transport (default for Docker modes)"
  echo "  -f, --force-rebuild    Force Docker image rebuild"
  echo "  -h, --help             Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                     Run locally with HTTP transport"
  echo "  $0 --stdio             Run locally with STDIO transport"
  echo "  $0 --docker            Run in Docker with STDIO transport"
  echo "  $0 --docker --http     Run in Docker with HTTP transport"
  echo "  $0 --docker-compose    Run with Docker Compose and MinIO"
  echo ""
}

# Parse command line arguments
USE_DOCKER_COMPOSE=false
USE_DOCKER_CLI=false
FORCE_REBUILD=false
TRANSPORT_TYPE=""  # Will be set based on context

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -dc|--docker-compose) USE_DOCKER_COMPOSE=true ;;
    -d|--docker) USE_DOCKER_CLI=true ;;
    --http) TRANSPORT_TYPE="http" ;;
    --stdio) TRANSPORT_TYPE="stdio" ;;
    -f|--force-rebuild) FORCE_REBUILD=true ;;
    -h|--help) show_usage; exit 0 ;;
    # For backward compatibility
    --docker-cli) USE_DOCKER_CLI=true; echo "Warning: --docker-cli is deprecated, use --docker instead." ;;
    # For backward compatibility
    *)
      # Special case for backward compatibility - use this flag to detect old --docker
      if [[ "$1" == "--docker" ]]; then
        echo "Warning: --docker is now used for Docker CLI mode. For Docker Compose, use --docker-compose instead."
        read -p "Do you want to run with Docker Compose? (Y/n): " answer
        if [[ "$answer" != "n" && "$answer" != "N" ]]; then
          USE_DOCKER_COMPOSE=true
        else
          USE_DOCKER_CLI=true
        fi
      else
        echo "Unknown parameter: $1"
        show_usage
        exit 1
      fi
      ;;
  esac
  shift
done

# Set default transport types if not specified
if [[ -z "$TRANSPORT_TYPE" ]]; then
  if [[ "$USE_DOCKER_COMPOSE" == "true" || "$USE_DOCKER_CLI" == "true" ]]; then
    TRANSPORT_TYPE="stdio"  # Default for Docker modes
  else
    TRANSPORT_TYPE="http"   # Default for local mode
  fi
fi

# Check for appropriate env files
if [ "$USE_DOCKER_CLI" = true ] && [ ! -f .env ]; then
  echo "ERROR: .env file not found. Please create one based on .env.example."
  echo "Make sure to fill in your AWS credentials."
  exit 1
fi

# Function to check if docker image rebuild is needed
check_rebuild_needed() {
  # Check if image exists
  if ! docker image inspect aws-s3-mcp &> /dev/null; then
    echo "Docker image doesn't exist. Build needed."
    return 0  # 0 = true in bash
  fi

  # Check if rebuild is forced
  if [ "$FORCE_REBUILD" = true ]; then
    echo "Rebuild forced by command line flag."
    return 0  # 0 = true in bash
  fi

  # Calculate the current Docker build context hash
  local DOCKERFILE_HASH=$(md5sum Dockerfile 2>/dev/null | awk '{print $1}')
  local PACKAGE_HASH=$(md5sum package.json package-lock.json 2>/dev/null | awk '{print $1}')
  local SOURCE_HASH=$(find ./src -type f -name "*.ts" -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}')
  local CURRENT_HASH="${DOCKERFILE_HASH}${PACKAGE_HASH}${SOURCE_HASH}"

  # Get the previous hash if it exists
  if [ -f .docker-build-hash ]; then
    local PREV_HASH=$(cat .docker-build-hash)

    if [ "$CURRENT_HASH" = "$PREV_HASH" ]; then
      echo "No changes detected to Dockerfile or source files."
      return 1  # 1 = false in bash
    else
      echo "Changes detected in build files. Rebuild needed."
      return 0  # 0 = true in bash
    fi
  else
    echo "No previous build hash found. Rebuild needed."
    return 0  # 0 = true in bash
  fi
}

# Function to save the current build hash
save_build_hash() {
  local DOCKERFILE_HASH=$(md5sum Dockerfile 2>/dev/null | awk '{print $1}')
  local PACKAGE_HASH=$(md5sum package.json package-lock.json 2>/dev/null | awk '{print $1}')
  local SOURCE_HASH=$(find ./src -type f -name "*.ts" -exec md5sum {} \; 2>/dev/null | sort | md5sum | awk '{print $1}')
  local CURRENT_HASH="${DOCKERFILE_HASH}${PACKAGE_HASH}${SOURCE_HASH}"

  echo "$CURRENT_HASH" > .docker-build-hash
  echo "Saved current build hash to .docker-build-hash"
}

if [ "$USE_DOCKER_COMPOSE" = true ]; then
  echo "Running using Docker Compose with MinIO..."

  # Check if Docker is installed
  if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker and try again."
    exit 1
  fi

  # Check if we need to rebuild (for Docker Compose)
  NEEDS_REBUILD=false
  if check_rebuild_needed; then
    NEEDS_REBUILD=true
  fi

  # Check if containers are already running, if not start them or rebuild if needed
  if ! docker compose ps --quiet s3-mcp | grep -q .; then
    if [ "$NEEDS_REBUILD" = true ]; then
      echo "Building and starting Docker containers using Docker Compose (with rebuild)..."
      docker compose build
      docker compose up -d
      save_build_hash
    else
      echo "Starting Docker containers using Docker Compose..."
      docker compose up -d
    fi

    # Give some time for MinIO to initialize properly
    echo "Waiting for MinIO to initialize (10 seconds)..."
    sleep 10
  elif [ "$NEEDS_REBUILD" = true ]; then
    echo "Rebuilding and restarting Docker containers using Docker Compose..."
    docker compose down
    docker compose build
    docker compose up -d
    save_build_hash

    # Give some time for MinIO to initialize properly
    echo "Waiting for MinIO to initialize (10 seconds)..."
    sleep 10
  else
    echo "Docker Compose containers already running"
  fi

  echo "Launching MCP Inspector with Dockerized S3 MCP server..."
  echo "MinIO Web UI is available at http://localhost:9001 (login with minioadmin/minioadmin)"
  echo ""

  # Launch the MCP Inspector with the container
  npx @modelcontextprotocol/inspector docker compose exec s3-mcp node dist/index.js

  # Note: We're keeping the containers running for future use, not stopping them
  echo "Containers remain running. To stop them use: docker compose down"

elif [ "$USE_DOCKER_CLI" = true ]; then
  echo "Running using Docker CLI with $TRANSPORT_TYPE transport..."

  # Check if Docker is installed
  if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker and try again."
    exit 1
  fi

  # Check if we need to rebuild
  REBUILD_NEEDED=false
  if check_rebuild_needed; then
    REBUILD_NEEDED=true
  fi

  # Build image if needed
  if [ "$REBUILD_NEEDED" = true ]; then
    echo "Building Docker image..."
    docker build -t aws-s3-mcp .
    save_build_hash
  fi

  if [ "$TRANSPORT_TYPE" = "http" ]; then
    # HTTP Transport mode
    CONTAINER_NAME="aws-s3-mcp-http-server"
    
    # Remove existing container if rebuilding
    if [ "$REBUILD_NEEDED" = true ]; then
      EXISTING_CONTAINER=$(docker ps -aq -f name=$CONTAINER_NAME)
      if [ -n "$EXISTING_CONTAINER" ]; then
        echo "Removing existing container for rebuilt image..."
        docker rm -f $EXISTING_CONTAINER >/dev/null 2>&1
      fi
    fi

    # Check if HTTP container is already running
    EXISTING_CONTAINER=$(docker ps -q -f name=$CONTAINER_NAME)

    if [ -z "$EXISTING_CONTAINER" ]; then
      echo "Starting HTTP MCP server container..."
      # Load environment variables from .env file
      ENV_VARS=$(cat .env | grep -v '^#' | xargs -I{} echo "-e {}")

      # Run the container with HTTP server, exposing port 3000
      docker run -d $ENV_VARS -p 3000:3000 --name $CONTAINER_NAME aws-s3-mcp http
      CONTAINER_ID=$(docker ps -q -f name=$CONTAINER_NAME)

      # Wait a moment for the server to start
      echo "Waiting for HTTP server to start..."
      sleep 3
    else
      echo "HTTP server container already running"
      CONTAINER_ID=$EXISTING_CONTAINER
    fi

    echo "Container ID: $CONTAINER_ID"
    echo "HTTP MCP Server is running on http://localhost:3000"
    echo "Health check: http://localhost:3000/health"
    echo "MCP endpoint: http://localhost:3000/mcp"
    echo "SSE endpoint: http://localhost:3000/sse"
    echo ""
    echo "Launching MCP Inspector to connect to HTTP server..."

    # Launch MCP Inspector connected to the HTTP server
    npx @modelcontextprotocol/inspector http://localhost:3000/mcp

    echo "Container remains running. To stop it use: docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"

  else
    # STDIO Transport mode (original behavior)
    CONTAINER_NAME="aws-s3-mcp-server"
    
    # Remove existing container if rebuilding
    if [ "$REBUILD_NEEDED" = true ]; then
      EXISTING_CONTAINER=$(docker ps -aq -f name=$CONTAINER_NAME)
      if [ -n "$EXISTING_CONTAINER" ]; then
        echo "Removing existing container for rebuilt image..."
        docker rm -f $EXISTING_CONTAINER >/dev/null 2>&1
      fi

      # Start new container after rebuild
      echo "Starting new Docker container with rebuilt image..."
      ENV_VARS=$(cat .env | grep -v '^#' | xargs -I{} echo "-e {}")
      docker run -d $ENV_VARS --name $CONTAINER_NAME aws-s3-mcp
      CONTAINER_ID=$(docker ps -q -f name=$CONTAINER_NAME)
    else
      # Check if container is already running
      EXISTING_CONTAINER=$(docker ps -q -f name=$CONTAINER_NAME)

      if [ -z "$EXISTING_CONTAINER" ]; then
        echo "Starting new Docker container..."
        # Load environment variables from .env file
        ENV_VARS=$(cat .env | grep -v '^#' | xargs -I{} echo "-e {}")

        # Run the container in detached mode
        docker run -d $ENV_VARS --name $CONTAINER_NAME aws-s3-mcp
        CONTAINER_ID=$(docker ps -q -f name=$CONTAINER_NAME)
      else
        echo "Using existing Docker container"
        CONTAINER_ID=$EXISTING_CONTAINER
      fi
    fi

    echo "Container ID: $CONTAINER_ID"
    echo "Launching MCP Inspector with the Docker container (STDIO)..."
    echo ""

    # Run the MCP Inspector in the container
    npx @modelcontextprotocol/inspector docker exec -i $CONTAINER_ID node ./dist/index.js

    echo "Container remains running. To stop it use: docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"
  fi
else
  # Local execution (no Docker)
  # Check if S3 MCP server is built
  if [ ! -d dist ]; then
    echo "Building S3 MCP server..."
    npm run build
  fi

  if [ "$TRANSPORT_TYPE" = "http" ]; then
    # HTTP Transport mode
    echo "Launching MCP Inspector with local S3 MCP server (HTTP transport)..."
    echo "This will open in your browser. If it doesn't, check the terminal output for a URL to open."
    echo ""

    # Use the new modular architecture with HTTP transport
    npx @modelcontextprotocol/inspector node ./dist/index.js --http
    
    echo ""
    echo "MCP Inspector is running on http://localhost:3000"
    echo "Health check: http://localhost:3000/health"
    echo "MCP endpoint: http://localhost:3000/mcp" 
    echo "SSE endpoint: http://localhost:3000/sse"
  else
    # STDIO Transport mode
    echo "Launching MCP Inspector with local S3 MCP server (STDIO transport)..."
    echo "This will open in your browser. If it doesn't, check the terminal output for a URL to open."
    echo ""

    # Use STDIO transport (original behavior)
    npx @modelcontextprotocol/inspector node ./dist/index.js
  fi
fi

# Exit gracefully
exit 0
