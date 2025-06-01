import { serve } from "@hono/node-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  createMockNodeRequest,
  createMockNodeResponse,
  createStreamingResponse,
} from "../utils/httpMock.js";
import type { HttpTransportConfig, ITransport, ITransportFactory } from "./types.js";

export class HttpTransport implements ITransport {
  private app: Hono;
  private config: Required<HttpTransportConfig>;
  private activeSessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: McpServer }
  >();

  constructor(config: HttpTransportConfig = {}) {
    this.config = {
      port: config.port || 3000,
      cors: {
        origin: config.cors?.origin || "*",
        allowMethods: config.cors?.allowMethods || ["GET", "POST", "DELETE", "OPTIONS"],
        allowHeaders: config.cors?.allowHeaders || [
          "Content-Type",
          "Authorization",
          "Accept",
          "x-mcp-session-id",
          "mcp-session-id",
        ],
      },
    };
    this.app = new Hono();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use("*", logger());
    this.app.use(
      "*",
      cors({
        origin: this.config.cors.origin || "*",
        allowMethods: this.config.cors.allowMethods || ["GET", "POST", "DELETE", "OPTIONS"],
        allowHeaders: this.config.cors.allowHeaders || ["Content-Type", "Authorization", "Accept"],
      }),
    );
  }

  private setupRoutes(server: McpServer): void {
    // Health check endpoint
    this.app.get("/health", (c) => {
      return c.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // MCP POST endpoint
    this.app.post("/mcp", async (c) => {
      try {
        const parsedBody = await c.req.json();
        const req = createMockNodeRequest(c, parsedBody);

        // Fix Accept header for SSE clients
        const acceptHeader = req.headers.accept || req.headers.Accept;
        if (acceptHeader === "text/event-stream") {
          req.headers.accept = "application/json, text/event-stream";
          req.headers.Accept = "application/json, text/event-stream";
        }

        // Handle session ID
        const sessionId = c.req.query("sessionId");
        if (sessionId) {
          req.headers["mcp-session-id"] = sessionId;
        }

        const effectiveSessionId =
          sessionId || req.headers["mcp-session-id"] || req.headers["x-mcp-session-id"];
        const session = this.getOrCreateSession(effectiveSessionId as string, server);
        const { response: res, getResponse } = createMockNodeResponse();

        await session.transport.handleRequest(req, res, parsedBody);
        const response = await getResponse();
        const responseText = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());

        return new Response(responseText, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch {
        return c.json({ error: "Internal server error" }, 500);
      }
    });

    // SSE endpoint
    this.app.get("/sse", async (c) => {
      try {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        const streamingRes = createStreamingResponse(writer);
        const sessionId = crypto.randomUUID();
        const transport = new SSEServerTransport(`/mcp?sessionId=${sessionId}`, streamingRes);
        await server.connect(transport);

        return new Response(readable, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Last-Event-ID, Mcp-Session-Id",
          },
        });
      } catch {
        return c.json({ error: "Internal server error" }, 500);
      }
    });

    this.app.get("/mcp", async (c) => {
      return c.redirect("/sse");
    });
  }

  private getOrCreateSession(sessionId?: string, server?: McpServer) {
    const id = sessionId || crypto.randomUUID();

    const existing = this.activeSessions.get(id);
    if (existing) {
      return existing;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => id,
      enableJsonResponse: true,
    });

    if (!server) {
      throw new Error("Server instance is required");
    }

    const session = { transport, server };
    this.activeSessions.set(id, session);

    server.connect(transport).catch(() => {
      this.activeSessions.delete(id);
    });

    return session;
  }

  async connect(server: McpServer): Promise<void> {
    this.setupRoutes(server);

    serve({
      fetch: this.app.fetch,
      port: this.config.port,
    });

    console.log(`HTTP server running on port ${this.config.port}`);
  }

  async disconnect(): Promise<void> {
    this.activeSessions.clear();
  }
}

export class HttpTransportFactory implements ITransportFactory {
  createTransport(config?: HttpTransportConfig): ITransport {
    return new HttpTransport(config);
  }
}
