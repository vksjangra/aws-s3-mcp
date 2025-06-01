#!/usr/bin/env node
import { Application } from "./application.js";
import { TransportType } from "./transports/index.js";

// Create and start HTTP application
const config = {
  transport: TransportType.HTTP,
  httpConfig: {
    port: Number.parseInt(process.env.PORT || "3000", 10),
  },
};

const app = new Application(config);
app.start();
