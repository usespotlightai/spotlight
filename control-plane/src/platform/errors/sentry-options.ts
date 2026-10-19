import { originOf, urlShape } from '@platform/errors/url-shape';
import {
  REDACTED_REQUEST_HEADERS,
  REDACTED_RESPONSE_HEADERS,
} from '@platform/logging/redacted-headers';
import {
  type Breadcrumb,
  type ErrorEvent,
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
    beforeSend: scrubbed,
    beforeBreadcrumb: withoutPath,
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

  event.breadcrumbs = event.breadcrumbs?.map(withoutPath);

  return event;
}

const OUTBOUND = new Set(['http', 'fetch']);

function withoutPath(breadcrumb: Breadcrumb): Breadcrumb {
  const url = breadcrumb.data?.url;

  if (typeof url !== 'string') {
    return breadcrumb;
  }

  return {
    ...breadcrumb,
    data: {
      ...breadcrumb.data,
      url: OUTBOUND.has(breadcrumb.category ?? '')
        ? originOf(url)
        : urlShape(url),
    },
  };
}
