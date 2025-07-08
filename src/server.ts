import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { S3Resource } from "./resources/s3.js";
import { createTools } from "./tools/index.js";

export interface ServerDependencies {
  s3Resource?: S3Resource;
  serverName?: string;
  serverVersion?: string;
}

/**
 * Create and configure the MCP server with S3 tools
 * Following Dependency Injection principle for better testability
 */
export function createServer(dependencies: ServerDependencies = {}): McpServer {
  const {
    s3Resource = new S3Resource(process.env.AWS_REGION || "us-east-1"),
    serverName = "s3-mcp-server",
    serverVersion = "0.4.0",
  } = dependencies;

  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  // Create and register all tools
  const tools = createTools(s3Resource);
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.parameters, tool.execute.bind(tool));
  }

  return server;
}
