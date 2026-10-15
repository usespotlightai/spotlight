import type { IncomingMessage } from 'node:http';

const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/;
const NIL_TRACE_ID = '0'.repeat(32);

export function traceIdOf(req: IncomingMessage): string | undefined {
  const header = req.headers.traceparent;
  const value = Array.isArray(header) ? header[0] : header;
  const traceId = value?.match(TRACEPARENT)?.[1];

  return traceId && traceId !== NIL_TRACE_ID ? traceId : undefined;
}
