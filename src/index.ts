#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { S3Resource } from "./resources/s3Resource.js";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file if it exists
dotenv.config();

// Create server instance
const server = new McpServer({
  name: "s3-mcp-server",
  version: "0.1.0",
});

// Initialize S3Resource class
const s3Resource = new S3Resource();

// Define S3 bucket listing tool
server.tool(
  "list-buckets",
  "List available S3 buckets",
  {},
  async () => {
    try {
      const buckets = await s3Resource.listBuckets();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(buckets, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error in list-buckets tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error listing buckets: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Define S3 object listing tool
server.tool(
  "list-objects",
  "List objects in an S3 bucket",
  {
    bucket: z.string().describe("Name of the S3 bucket"),
    prefix: z.string().optional().describe("Prefix to filter objects (like a folder)"),
    maxKeys: z.number().optional().describe("Maximum number of objects to return"),
  },
  async ({ bucket, prefix, maxKeys }) => {
    try {
      const objects = await s3Resource.listObjects(
        bucket,
        prefix || "",
        maxKeys || 1000
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(objects, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error in list-objects tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error listing objects in bucket ${bucket}: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Define S3 object retrieval tool
server.tool(
  "get-object",
  "Retrieve an object from an S3 bucket",
  {
    bucket: z.string().describe("Name of the S3 bucket"),
    key: z.string().describe("Key (path) of the object to retrieve"),
  },
  async ({ bucket, key }) => {
    try {
      const result = await s3Resource.getObject(bucket, key);

      // For text content, return as text
      if (typeof result.data === "string") {
        return {
          content: [
            {
              type: "text",
              text: result.data,
            },
          ],
        };
      }

      // For binary content, return as base64-encoded string
      return {
        content: [
          {
            type: "text",
            text: `Binary content (${result.contentType}): base64 data is ${result.data.toString("base64").substring(0, 100)}...`,
          },
        ],
      };
    } catch (error) {
      console.error("Error in get-object tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error getting object ${key} from bucket ${bucket}: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
