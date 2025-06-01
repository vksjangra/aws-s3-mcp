import { spawn } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMockBuckets } from "../mocks/s3Client.mock";

// Mock the S3Client for HTTP server tests
vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual("@aws-sdk/client-s3");
  const mockSend = vi.fn().mockResolvedValue({
    Buckets: createMockBuckets(3),
  });

  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
      config: {},
      middlewareStack: { clone: () => ({ use: () => {} }) },
      destroy: () => {},
    })),
  };
});

describe("HTTP MCP Server", () => {
  const TEST_PORT = 3001;
  let serverProcess: any;
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = `http://localhost:${TEST_PORT}`;

    // Set environment for HTTP mode
    process.env.MCP_TRANSPORT = "http";
    process.env.PORT = TEST_PORT.toString();
    process.env.S3_BUCKETS = "test-bucket-1,test-bucket-2";

    // Start the HTTP server using new architecture
    const serverPath = path.resolve(process.cwd(), "dist/index.js");
    serverProcess = spawn("node", [serverPath, "--http"], {
      env: {
        ...process.env,
        PORT: TEST_PORT.toString(),
        S3_BUCKETS: "test-bucket-1,test-bucket-2",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server failed to start within timeout"));
      }, 10000);

      const checkServer = async () => {
        try {
          const response = await fetch(`${baseUrl}/health`);
          if (response.ok) {
            clearTimeout(timeout);
            resolve(true);
          } else {
            setTimeout(checkServer, 100);
          }
        } catch {
          setTimeout(checkServer, 100);
        }
      };

      checkServer();
    });
  }, 15000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      // Wait for process to exit
      await new Promise((resolve) => {
        serverProcess.on("exit", resolve);
        setTimeout(() => {
          serverProcess.kill("SIGKILL");
          resolve(true);
        }, 5000);
      });
    }
    process.env.MCP_TRANSPORT = undefined;
    process.env.PORT = undefined;
    process.env.S3_BUCKETS = undefined;
  });

  it("should respond to health check endpoint", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("timestamp");
  });

  it("should handle MCP initialization request", async () => {
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    };

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initRequest),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("jsonrpc", "2.0");
    expect(data).toHaveProperty("id", 1);
    expect(data).toHaveProperty("result");
  });

  it("should handle tools/list request", async () => {
    // First initialize the session
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    };

    const sessionId = "test-session-2";
    const initResponse = await fetch(`${baseUrl}/mcp?sessionId=${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initRequest),
    });
    expect(initResponse.status).toBe(200);

    // Now make the tools/list request
    const toolsListRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    };

    const response = await fetch(`${baseUrl}/mcp?sessionId=${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toolsListRequest),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("jsonrpc", "2.0");
    expect(data).toHaveProperty("id", 2);
    expect(data).toHaveProperty("result");
    expect(data.result).toHaveProperty("tools");

    const tools = data.result.tools;
    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);

    // Check that expected S3 tools are present
    const toolNames = tools.map((tool: any) => tool.name);
    expect(toolNames).toContain("list-buckets");
    expect(toolNames).toContain("list-objects");
    expect(toolNames).toContain("get-object");
  });

  it("should handle list-buckets tool call", async () => {
    // First initialize the session
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    };

    const sessionId = "test-session-3";
    const initResponse = await fetch(`${baseUrl}/mcp?sessionId=${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initRequest),
    });
    expect(initResponse.status).toBe(200);

    // Now make the tool call
    const toolCallRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "list-buckets",
        arguments: {},
      },
    };

    const response = await fetch(`${baseUrl}/mcp?sessionId=${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toolCallRequest),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("jsonrpc", "2.0");
    expect(data).toHaveProperty("id", 3);
    expect(data).toHaveProperty("result");
    expect(data.result).toHaveProperty("content");
  });

  it("should handle CORS preflight requests", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("should handle invalid JSON-RPC requests", async () => {
    const invalidRequest = {
      invalid: "request",
    };

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invalidRequest),
    });

    // StreamableHTTPServerTransport returns 400 for parse errors
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("jsonrpc", "2.0");
    expect(data).toHaveProperty("error");
  });

  it("should handle malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "invalid json",
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty("error", "Internal server error");
  });
});
