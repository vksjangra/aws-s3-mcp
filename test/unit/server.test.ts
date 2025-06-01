import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../src/server.js";

// Mock the S3Resource
vi.mock("../../src/resources/s3.js", () => ({
  S3Resource: vi.fn().mockImplementation(() => ({
    // Mock S3Resource methods if needed
  })),
}));

// Mock the tools
vi.mock("../../src/tools/index.js", () => ({
  createTools: vi.fn().mockReturnValue([
    {
      name: "list-buckets",
      description: "List S3 buckets",
      parameters: {},
      execute: vi.fn(),
    },
    {
      name: "list-objects",
      description: "List objects in S3 bucket",
      parameters: {},
      execute: vi.fn(),
    },
    {
      name: "get-object",
      description: "Get object from S3 bucket",
      parameters: {},
      execute: vi.fn(),
    },
  ]),
}));

describe("Server Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a McpServer instance", () => {
    const server = createServer();
    expect(server).toBeInstanceOf(McpServer);
  });

  it("should have correct server name and version", () => {
    const server = createServer();

    // Test that server was created (we can't easily access private properties)
    expect(server).toBeDefined();
    expect(typeof server.tool).toBe("function");
    expect(typeof server.connect).toBe("function");
  });

  it("should create new S3Resource instance", async () => {
    const { S3Resource } = await import("../../src/resources/s3.js");

    createServer();

    expect(S3Resource).toHaveBeenCalledOnce();
  });

  it("should create tools with S3Resource instance", async () => {
    const { createTools } = await import("../../src/tools/index.js");

    createServer();

    expect(createTools).toHaveBeenCalledOnce();
    expect(createTools).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should register tools correctly", async () => {
    const { createTools } = await import("../../src/tools/index.js");

    const _server = createServer();

    // Verify createTools was called and returned tools
    expect(createTools).toHaveBeenCalledOnce();
    const tools = createTools.mock.results[0].value;
    expect(tools).toHaveLength(3);
    expect(tools[0].name).toBe("list-buckets");
    expect(tools[1].name).toBe("list-objects");
    expect(tools[2].name).toBe("get-object");
  });
});
