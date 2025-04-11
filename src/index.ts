#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { S3Resource } from "./resources/s3.js";
import { createTools } from "./tools/index.js";
import dotenv from "dotenv";

// Process command-line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
aws-s3-mcp - S3 Model Context Protocol Server

Usage:
  aws-s3-mcp [options]

Options:
  -h, --help     Show this help message
  -v, --version  Show version information

Environment Variables:
  AWS_REGION            AWS region where your S3 buckets are located
  S3_BUCKETS            Comma-separated list of allowed S3 bucket names
  S3_MAX_BUCKETS        Maximum number of buckets to return in listing
  AWS_ACCESS_KEY_ID     AWS access key (if using explicit credentials)
  AWS_SECRET_ACCESS_KEY AWS secret key (if using explicit credentials)

For more information, visit: https://github.com/samuraikun/aws-s3-mcp
  `);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log('aws-s3-mcp v0.1.0');
  process.exit(0);
}

// Load environment variables from .env file if it exists
dotenv.config();

// Create server instance
const server = new McpServer({
  name: "s3-mcp-server",
  version: "0.1.0",
});

// Initialize S3Resource class
const s3Resource = new S3Resource();

// Create and register all tools
const tools = createTools(s3Resource);
for (const tool of tools) {
  server.tool(
    tool.name,
    tool.description,
    tool.parameters,
    tool.execute.bind(tool)
  );
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
