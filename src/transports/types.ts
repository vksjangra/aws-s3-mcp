import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface ITransport {
  connect(server: McpServer): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface ITransportFactory {
  createTransport(config?: any): ITransport;
}

export enum TransportType {
  STDIO = "stdio",
  HTTP = "http",
  SSE = "sse",
}

export interface HttpTransportConfig {
  port?: number;
  cors?: {
    origin?: string;
    allowMethods?: string[];
    allowHeaders?: string[];
  };
}
