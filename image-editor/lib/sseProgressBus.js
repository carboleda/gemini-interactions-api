/**
 * A simple event bus for sending progress updates to clients via Server-Sent Events (SSE).
 * Each request is identified by a unique requestId, and clients can subscribe to receive
 * progress updates for that specific request.
 */

const connections = new Map();

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function subscribe(requestId, req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  connections.set(requestId, res);

  req.on("close", () => {
    if (connections.get(requestId) === res) {
      connections.delete(requestId);
    }
  });
}

export function emit(requestId, phase) {
  const res = connections.get(requestId);
  if (!res) return;
  writeEvent(res, "phase", { phase, at: Date.now() });
}

export function fail(requestId, message) {
  const res = connections.get(requestId);
  if (!res) return;
  writeEvent(res, "error", { message });
}

export function done(requestId) {
  const res = connections.get(requestId);
  if (!res) return;
  writeEvent(res, "done", { at: Date.now() });
  res.end();
  connections.delete(requestId);
}
