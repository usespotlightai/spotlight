import { originOf, urlShape } from '@platform/errors/url-shape';
import {
  REDACTED_REQUEST_HEADERS,
  REDACTED_RESPONSE_HEADERS,
} from '@platform/logging/redacted-headers';
import { unavailabilityReason } from '@platform/persistence/drizzle/violations';
import {
  type Breadcrumb,
  type ErrorEvent,
  type EventHint,
  type NodeOptions,
  openTelemetryIntegration,
} from '@sentry/nestjs';

type SentryEnv = {
  readonly SENTRY_DSN?: string;
  readonly SENTRY_ENVIRONMENT?: string;
  readonly SPOTLIGHT_RELEASE?: string;
};

const REDACTED_HEADERS = new Set(
  [...REDACTED_REQUEST_HEADERS, ...REDACTED_RESPONSE_HEADERS].map((name) =>
    name.toLowerCase(),
  ),
);

export function sentryOptions(
  env: SentryEnv,
  { openTelemetry = false }: { openTelemetry?: boolean } = {},
): NodeOptions | undefined {
  if (!env.SENTRY_DSN) {
    return undefined;
  }

  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || undefined,
    release: env.SPOTLIGHT_RELEASE || undefined,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: REDACTED_REQUEST_HEADERS },
        response: { deny: REDACTED_RESPONSE_HEADERS },
      },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
    beforeSend: (event, hint) => fingerprint(scrubbed(event), hint),
    beforeBreadcrumb: scrubBreadcrumb,
    integrations: openTelemetry
      ? (defaults) => [...defaults, openTelemetryIntegration()]
      : undefined,
  };
}

function scrubbed(event: ErrorEvent): ErrorEvent {
  const request = event.request;

  if (request) {
    request.url = urlShape(request.url);
    delete request.query_string;
    delete request.cookies;
    delete request.data;

    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers)
          .filter(([name]) => !REDACTED_HEADERS.has(name.toLowerCase()))
          .map(([name, value]) => [
            name,
            name.toLowerCase() === 'referer' ? urlShape(value) : value,
          ]),
      );
    }
  }

  if (event.user) {
    event.user =
      event.user.id === undefined ? undefined : { id: event.user.id };
  }

  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);

  for (const exception of event.exception?.values ?? []) {
    exception.value = exception.value && stripParams(exception.value);
  }

  return event;
}

const FAILED_QUERY = 'Failed query: ';

const QUERY_PARAMS = '\nparams: ';

const stripParams = (text: string): string => {
  const params = text.indexOf(QUERY_PARAMS);

  return text.includes(FAILED_QUERY) && params !== -1
    ? text.slice(0, params)
    : text;
};

const MAX_ARGUMENT_DEPTH = 3;

const stripArgument = (argument: unknown, depth = 0): unknown => {
  if (typeof argument === 'string') {
    return stripParams(argument);
  }

  if (argument instanceof Error) {
    return `${argument.name}: ${stripParams(argument.message)}`;
  }

  if (typeof argument !== 'object' || argument === null) {
    return argument;
  }

  if (depth >= MAX_ARGUMENT_DEPTH) {
    return '[Object]';
  }

  return Array.isArray(argument)
    ? argument.map((each) => stripArgument(each, depth + 1))
    : Object.fromEntries(
        Object.entries(argument).map(([key, value]) => [
          key,
          stripArgument(value, depth + 1),
        ]),
      );
};

function fingerprint(event: ErrorEvent, hint: EventHint): ErrorEvent {
  const unavailable = unavailabilityReason(hint.originalException);

  if (unavailable === null) {
    return event;
  }

  const values = event.exception?.values ?? [];
  const main = values[values.length - 1];

  if (main) {
    event.extra = { ...event.extra, originalMessage: main.value };
    main.value = `The database is unavailable: ${unavailable}`;
  }

  event.fingerprint = ['database-unavailable', unavailable];

  return event;
}

const OUTBOUND = new Set(['http', 'fetch']);

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const url: unknown = breadcrumb.data?.url;
  const consoleArguments: unknown = breadcrumb.data?.arguments;
  const clean = {
    ...breadcrumb,
    ...(breadcrumb.message === undefined
      ? {}
      : { message: stripParams(breadcrumb.message) }),
    ...(Array.isArray(consoleArguments)
      ? {
          data: {
            ...breadcrumb.data,
            arguments: consoleArguments.map((each) => stripArgument(each)),
          },
        }
      : {}),
  };

  if (typeof url !== 'string') {
    return clean;
  }

  return {
    ...clean,
    data: {
      ...clean.data,
      url: OUTBOUND.has(breadcrumb.category ?? '')
        ? originOf(url)
        : urlShape(url),
    },
  };
}
