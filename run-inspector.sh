#!/bin/bash

# Run MCP Inspector for S3 MCP Server
# This script launches the MCP Inspector connected to our S3 MCP server

# Check if .env file exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Please create one based on .env.example."
  echo "Make sure to fill in your AWS credentials."
  exit 1
fi

# Check if S3 MCP server is built
if [ ! -d dist ]; then
  echo "Building S3 MCP server..."
  npm run build
fi

# Launch the MCP Inspector
echo "Launching MCP Inspector with S3 MCP server..."
echo "This will open in your browser. If it doesn't, check the terminal output for a URL to open."
echo "Test the S3 tools against samuraikun-dev-blog bucket as described in INSPECTOR_GUIDE.md"
echo ""

npx @modelcontextprotocol/inspector npx aws-s3-mcp

# Exit gracefully
exit 0
