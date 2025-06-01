import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ITransport, ITransportFactory } from "./types.js";

export class StdioTransport implements ITransport {
  private transport: StdioServerTransport;

  constructor() {
    this.transport = new StdioServerTransport();
  }

  async connect(server: McpServer): Promise<void> {
    await server.connect(this.transport);
  }

  async disconnect(): Promise<void> {
    // StdioServerTransport doesn't have a disconnect method
    // The process will exit when the connection is closed
  }
}

export class StdioTransportFactory implements ITransportFactory {
  createTransport(): ITransport {
    return new StdioTransport();
  }
}
