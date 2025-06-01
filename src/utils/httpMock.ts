import type { IncomingMessage, ServerResponse } from "node:http";

export function createMockNodeRequest(c: any, body?: any): IncomingMessage {
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  const url = new URL(c.req.url);

  const req = {
    method: c.req.method,
    url: url.pathname + url.search,
    headers,
    httpVersion: "1.1",
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    body,
    socket: {
      remoteAddress: "127.0.0.1",
      remotePort: 0,
    },
    connection: {
      remoteAddress: "127.0.0.1",
      remotePort: 0,
    },
    on: () => {},
    once: () => {},
    emit: () => {},
    pipe: () => {},
    read: () => null,
    readable: false,
    readableEnded: true,
  } as unknown as IncomingMessage;

  return req;
}

export function createMockNodeResponse(): {
  response: ServerResponse;
  getResponse: () => Promise<Response>;
} {
  let responseData: any = null;
  let statusCode = 200;
  const headers: Record<string, string> = {};
  let responseEnded = false;
  let headersSent = false;
  let finished = false;
  let endResolver: () => void;
  const endPromise = new Promise<void>((resolve) => {
    endResolver = resolve;
  });

  const res = {
    writeHead: function (code: number, responseHeaders?: Record<string, string>) {
      statusCode = code;
      if (responseHeaders) {
        Object.assign(headers, responseHeaders);
      }
      headersSent = true;
      return this;
    },
    setHeader: function (name: string, value: string) {
      headers[name] = value;
      return this;
    },
    getHeader: (name: string) => {
      return headers[name.toLowerCase()];
    },
    getHeaders: () => {
      return { ...headers };
    },
    hasHeader: (name: string) => {
      return name.toLowerCase() in headers;
    },
    removeHeader: function (name: string) {
      delete headers[name.toLowerCase()];
      return this;
    },
    flushHeaders: function () {
      headersSent = true;
      return this;
    },
    write: (data: string) => {
      if (!responseData) {
        responseData = data;
      } else {
        responseData += data;
      }
      return true;
    },
    end: (data?: string) => {
      if (data && !responseData) {
        responseData = data;
      } else if (data) {
        responseData += data;
      }
      responseEnded = true;
      finished = true;
      endResolver();
    },
    statusCode: 200,
    statusMessage: "OK",
    get headersSent() {
      return headersSent;
    },
    get finished() {
      return finished;
    },
    get writableEnded() {
      return responseEnded;
    },
    get writableFinished() {
      return finished;
    },
    writable: true,
    writableCorked: 0,
    writableHighWaterMark: 16384,
    writableLength: 0,
    on: () => {},
    once: () => {},
    emit: () => {
      return false;
    },
    addListener: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    listeners: () => [],
    listenerCount: () => 0,
    prependListener: () => {},
    prependOnceListener: () => {},
    cork: () => {},
    uncork: () => {},
    destroy: () => {},
    pipe: () => {},
    unpipe: () => {},
    socket: null,
    connection: null,
    addTrailers: () => {},
    writeContinue: () => {},
    setTimeout: () => {},
  } as unknown as ServerResponse;

  const getResponse = async (): Promise<Response> => {
    await endPromise;

    return new Response(responseData, {
      status: statusCode,
      statusText: statusCode === 200 ? "OK" : "Error",
      headers: new Headers(headers),
    });
  };

  return { response: res, getResponse };
}

export function createStreamingResponse(
  writer: WritableStreamDefaultWriter<Uint8Array>,
): ServerResponse {
  return {
    writeHead: function () {
      return this;
    },
    setHeader: function () {
      return this;
    },
    getHeader: () => undefined,
    getHeaders: () => ({}),
    hasHeader: () => false,
    removeHeader: function () {
      return this;
    },
    flushHeaders: function () {
      return this;
    },
    write: (data: string) => {
      writer.write(new TextEncoder().encode(data));
      return true;
    },
    end: (data?: string) => {
      if (data) {
        writer.write(new TextEncoder().encode(data));
      }
      writer.close();
    },
    statusCode: 200,
    statusMessage: "OK",
    headersSent: false,
    finished: false,
    writableEnded: false,
    writableFinished: false,
    writable: true,
    writableCorked: 0,
    writableHighWaterMark: 16384,
    writableLength: 0,
    on: () => {},
    once: () => {},
    emit: () => false,
    addListener: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    listeners: () => [],
    listenerCount: () => 0,
    prependListener: () => {},
    prependOnceListener: () => {},
    cork: () => {},
    uncork: () => {},
    destroy: () => {},
    pipe: () => {},
    unpipe: () => {},
    socket: null,
    connection: null,
    addTrailers: () => {},
    writeContinue: () => {},
    setTimeout: () => {},
  } as unknown as ServerResponse;
}
