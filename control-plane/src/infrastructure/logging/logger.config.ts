import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Env } from '@infrastructure/config/env.schema';
import { RequestMethod } from '@nestjs/common';
import type { Params } from 'nestjs-pino';

const REQUEST_ID_HEADER = 'x-request-id';

/** W3C trace-context: `<version>-<32 hex trace id>-<16 hex span id>-<flags>`. */
const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/;
const NIL_TRACE_ID = '0'.repeat(32);

function traceIdOf(req: IncomingMessage): string | undefined {
  const header = req.headers.traceparent;
  const value = Array.isArray(header) ? header[0] : header;
  const traceId = value?.match(TRACEPARENT)?.[1];

  return traceId && traceId !== NIL_TRACE_ID ? traceId : undefined;
}

/**
 * Anything listed here is replaced by `[redacted]` before it reaches a log
 * sink. Sessions are cookie-based (better-auth), so the default request
 * serializer, which logs every header, would otherwise write valid session
 * tokens to disk on every request.
 */
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

/** Liveness probes run every 10s and would drown out real traffic. */
const IGNORED_PATHS = ['/api/health'];

export function buildLoggerConfig(
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
): Params {
  const isDevelopment = env.NODE_ENV === 'development';

  return {
    // nestjs-pino defaults to `*`, which the global prefix turns into
    // `/api/{*path}` — that matches `/api/anything` but not a bare `/api`/.
    // `/` covers the prefix itself.
    forRoutes: [
      { path: '/', method: RequestMethod.ALL },
      { path: '{*path}', method: RequestMethod.ALL },
    ],

    pinoHttp: {
      level: env.LOG_LEVEL,

      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = traceIdOf(req) ?? randomUUID();
        res.setHeader(REQUEST_ID_HEADER, id);
        return id;
      },

      redact: { paths: REDACT_PATHS, censor: '[redacted]' },

      autoLogging: {
        ignore: (req: IncomingMessage) => {
          const path = req.url?.split('?')[0];
          return path !== undefined && IGNORED_PATHS.includes(path);
        },
      },

      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },

      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,

      // Binds `reqId` to the per-request logger, so application logs carry the
      // id instead of the full serialized request repeated on every line. The
      // request-completed line inherits that binding and keeps the request.
      quietReqLogger: true,
    },
  };
}
