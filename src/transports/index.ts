import { HttpTransportFactory } from "./http.js";
import { StdioTransportFactory } from "./stdio.js";
import { type HttpTransportConfig, type ITransportFactory, TransportType } from "./types.js";

export function createTransportFactory(type: TransportType): ITransportFactory {
  switch (type) {
    case TransportType.STDIO:
      return new StdioTransportFactory();
    case TransportType.HTTP:
    case TransportType.SSE:
      return new HttpTransportFactory();
    default:
      throw new Error(`Unsupported transport type: ${type}`);
  }
}

export * from "./types.js";
export { StdioTransport, StdioTransportFactory } from "./stdio.js";
export { HttpTransport, HttpTransportFactory } from "./http.js";
