#!/bin/bash

# Run MCP Inspector for S3 MCP Server
# This script launches the MCP Inspector connected to our S3 MCP server

# Function to show usage
show_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo "Options:"
  echo "  -dc, --docker-compose  Run using Docker Compose with MinIO"
  echo "  -d, --docker           Run using Docker CLI (without Docker Compose)"
  echo "  -f, --force-rebuild    Force Docker image rebuild"
  echo "  -h, --help             Show this help message"
  echo ""
}

# Parse command line arguments
USE_DOCKER_COMPOSE=false
USE_DOCKER_CLI=false
FORCE_REBUILD=false

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -dc|--docker-compose) USE_DOCKER_COMPOSE=true ;;
    -d|--docker) USE_DOCKER_CLI=true ;;
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

# Check for appropriate env files
if [ "$USE_DOCKER_COMPOSE" = true ] && [ ! -f .env.local ]; then
  echo "ERROR: .env.local file not found for Docker Compose with MinIO setup."
  echo "Please create one based on the example in the README."
  exit 1
elif [ "$USE_DOCKER_CLI" = true ] && [ ! -f .env ]; then
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
      # 明示的に.env.localを指定してコンテナを起動
      docker compose --env-file .env.local up -d
      save_build_hash
    else
      echo "Starting Docker containers using Docker Compose..."
      # 明示的に.env.localを指定してコンテナを起動
      docker compose --env-file .env.local up -d
    fi

    # Give some time for MinIO to initialize properly
    echo "Waiting for MinIO to initialize (10 seconds)..."
    sleep 10
  elif [ "$NEEDS_REBUILD" = true ]; then
    echo "Rebuilding and restarting Docker containers using Docker Compose..."
    docker compose down
    docker compose build
    docker compose --env-file .env.local up -d
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
  echo "Running using Docker CLI (without Docker Compose)..."

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

    # Remove any existing container as we're rebuilding the image
    EXISTING_CONTAINER=$(docker ps -aq -f name=aws-s3-mcp-server)
    if [ -n "$EXISTING_CONTAINER" ]; then
      echo "Removing existing container for rebuilt image..."
      docker rm -f $EXISTING_CONTAINER >/dev/null 2>&1
    fi

    # Start new container after rebuild
    echo "Starting new Docker container with rebuilt image..."
    ENV_VARS=$(cat .env | grep -v '^#' | xargs -I{} echo "-e {}")
    docker run -d $ENV_VARS --name aws-s3-mcp-server aws-s3-mcp
    CONTAINER_ID=$(docker ps -q -f name=aws-s3-mcp-server)
  else
    # Check if container is already running
    EXISTING_CONTAINER=$(docker ps -q -f name=aws-s3-mcp-server)

    if [ -z "$EXISTING_CONTAINER" ]; then
      echo "Starting new Docker container..."
      # Load environment variables from .env file
      ENV_VARS=$(cat .env | grep -v '^#' | xargs -I{} echo "-e {}")

      # Run the container in detached mode
      docker run -d $ENV_VARS --name aws-s3-mcp-server aws-s3-mcp
      CONTAINER_ID=$(docker ps -q -f name=aws-s3-mcp-server)
    else
      echo "Using existing Docker container"
      CONTAINER_ID=$EXISTING_CONTAINER
    fi
  fi

  echo "Container ID: $CONTAINER_ID"
  echo "Launching MCP Inspector with the Docker container..."
  echo ""

  # Run the MCP Inspector in the container
  npx @modelcontextprotocol/inspector docker exec -i $CONTAINER_ID node ./dist/index.js

  echo "Container remains running. To stop it use: docker stop aws-s3-mcp-server && docker rm aws-s3-mcp-server"
else
  # Check if S3 MCP server is built
  if [ ! -d dist ]; then
    echo "Building S3 MCP server..."
    npm run build
  fi

  # Launch the MCP Inspector
  echo "Launching MCP Inspector with local S3 MCP server..."
  echo "This will open in your browser. If it doesn't, check the terminal output for a URL to open."
  echo ""

  npx @modelcontextprotocol/inspector node ./dist/index.js
fi

# Exit gracefully
exit 0
