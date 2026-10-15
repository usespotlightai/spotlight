import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RequestMethod } from '@nestjs/common';
import type { Env } from '@platform/config/env.schema';
import { traceIdOf } from '@platform/http/trace-id';
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

const IGNORED_PATHS = ['/api/health'];

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
    ? pino({ level, redact }, destination)
    : pino({ level, redact, transport });

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
