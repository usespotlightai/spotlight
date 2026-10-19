import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RequestMethod } from '@nestjs/common';
import type { Env } from '@platform/config/env.schema';
import { loggablePath } from '@platform/http/loggable-path';
import { refusalOf } from '@platform/http/refusal';
import { activeTraceId, traceIdOf } from '@platform/http/trace-id';
import { logContext } from '@platform/logging/log-context';
import {
  REDACTED_REQUEST_HEADERS,
  REDACTED_RESPONSE_HEADERS,
} from '@platform/logging/redacted-headers';
import type { Params } from 'nestjs-pino';
import { type DestinationStream, pino } from 'pino';
import pinoHttp, { type HttpLogger, type Options } from 'pino-http';

const REQUEST_ID_HEADER = 'x-request-id';

const REDACT_PATHS = [
  ...REDACTED_REQUEST_HEADERS.map((name) => `req.headers.${name}`),
  ...REDACTED_RESPONSE_HEADERS.map((name) => `res.headers["${name}"]`),
];

const IGNORED_PATHS = ['/api/health', '/api/health/ready'];

// Headers can carry secrets, such as a webhook's shared token or a presigned URL. Lines keep these only.
const LOGGED_REQUEST_HEADERS = [
  'accept',
  'content-length',
  'content-type',
  'traceparent',
  'user-agent',
];

const LOGGED_RESPONSE_HEADERS = [
  'content-length',
  'content-type',
  'etag',
  REQUEST_ID_HEADER,
];

const picked = (
  headers: unknown,
  names: readonly string[],
): Record<string, unknown> | undefined => {
  if (typeof headers !== 'object' || headers === null) {
    return undefined;
  }

  const all = headers as Record<string, unknown>;

  return Object.fromEntries(
    names
      .filter((name) => all[name] !== undefined)
      .map((name) => [name, all[name]]),
  );
};

type Routed = IncomingMessage & {
  originalUrl?: string;
  route?: { path?: unknown };
};

const locationOf = (req: IncomingMessage) => {
  const { originalUrl, url, route } = req as Routed;

  return {
    route: typeof route?.path === 'string' ? route.path : undefined,
    path: loggablePath({ url: originalUrl ?? url, route }),
  };
};

type LoggerEnv = Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>;

export type Logging = {
  params: Params;
  httpLogger: HttpLogger;
};

function buildOptions(env: LoggerEnv): Options {
  const isDevelopment = env.NODE_ENV === 'development';

  return {
    level: env.LOG_LEVEL,

    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const id = activeTraceId() ?? traceIdOf(req) ?? randomUUID();
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },

    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers: {
      req: (req: Record<string, unknown>) => ({
        ...req,
        url: undefined,
        query: undefined,
        params: undefined,
        headers: picked(req.headers, LOGGED_REQUEST_HEADERS),
      }),
      res: (res: Record<string, unknown>) => ({
        ...res,
        headers: picked(res.headers, LOGGED_RESPONSE_HEADERS),
      }),
    },
    customSuccessObject: (
      req: IncomingMessage,
      res: ServerResponse,
      line: Record<string, unknown>,
    ) => {
      const refusal = refusalOf(res);

      return { ...line, ...locationOf(req), ...(refusal ? { refusal } : {}) };
    },
    customErrorObject: (
      req: IncomingMessage,
      _res: ServerResponse,
      _err: Error,
      line: Record<string, unknown>,
    ) => ({ ...line, ...locationOf(req) }),

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

    quietReqLogger: true,
  };
}

export function buildLogging(
  env: LoggerEnv,
  destination?: DestinationStream,
): Logging {
  const options = buildOptions(env);
  const { level, redact, transport } = options;

  const logger = destination
    ? pino({ level, redact, mixin: logContext }, destination)
    : pino({ level, redact, transport, mixin: logContext });

  const shared: Options = { ...options, logger };
  const httpLogger = pinoHttp(shared);

  return {
    params: {
      // The nestjs-pino default `*` becomes `/api/{*path}`. That path does not match `/api` alone.
      forRoutes: [
        { path: '/', method: RequestMethod.ALL },
        { path: '{*path}', method: RequestMethod.ALL },
      ],
      pinoHttp: shared,
    },
    httpLogger,
  };
}
