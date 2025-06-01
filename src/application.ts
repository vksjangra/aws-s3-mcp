#!/usr/bin/env node
import dotenv from "dotenv";
import { createServer } from "./server.js";
import {
  type HttpTransportConfig,
  TransportType,
  createTransportFactory,
} from "./transports/index.js";

export interface ApplicationConfig {
  transport: TransportType;
  httpConfig?: HttpTransportConfig;
  loadEnvFile?: boolean;
}

export class Application {
  private config: ApplicationConfig;

  constructor(config: ApplicationConfig) {
    this.config = config;

    if (config.loadEnvFile !== false) {
      dotenv.config();
    }
  }

  async start(): Promise<void> {
    try {
      const server = createServer();
      const transportFactory = createTransportFactory(this.config.transport);
      const transport = transportFactory.createTransport(this.config.httpConfig);

      await transport.connect(server);

      if (this.config.transport === TransportType.STDIO) {
        // For STDIO transport, the process should continue running
        // until the connection is closed
      } else {
        console.log(`Application started with ${this.config.transport} transport`);
      }
    } catch (error) {
      console.error("Fatal error in Application.start():", error);
      process.exit(1);
    }
  }
}

export function parseArgs(args: string[]): ApplicationConfig {
  const hasHttp = args.includes("--http") || process.env.MCP_TRANSPORT === "http";
  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

  return {
    transport: hasHttp ? TransportType.HTTP : TransportType.STDIO,
    httpConfig: hasHttp ? { port } : undefined,
  };
}

export function showHelp(): void {
  console.log(`
aws-s3-mcp - S3 Model Context Protocol Server

Usage:
  aws-s3-mcp [options]

Options:
  -h, --help     Show this help message
  -v, --version  Show version information
  --http         Start HTTP server instead of stdio transport

Environment Variables:
  AWS_REGION            AWS region where your S3 buckets are located
  S3_BUCKETS            Comma-separated list of allowed S3 bucket names
  S3_MAX_BUCKETS        Maximum number of buckets to return in listing
  AWS_ACCESS_KEY_ID     AWS access key (if using explicit credentials)
  AWS_SECRET_ACCESS_KEY AWS secret key (if using explicit credentials)
  PORT                  Port for HTTP server (default: 3000)

For more information, visit: https://github.com/samuraikun/aws-s3-mcp
  `);
}

export function showVersion(): void {
  console.log("aws-s3-mcp v0.2.5");
}
