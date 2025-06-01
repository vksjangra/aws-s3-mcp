#!/usr/bin/env node
import { Application, parseArgs, showHelp, showVersion } from "./application.js";

// Process command-line arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  showHelp();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  showVersion();
  process.exit(0);
}

// Parse configuration and start application
const config = parseArgs(args);
const app = new Application(config);

app.start().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
