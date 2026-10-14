import {
  REDACTED_REQUEST_HEADERS,
  REDACTED_RESPONSE_HEADERS,
} from '@platform/logging/redacted-headers';
import type { Breadcrumb, ErrorEvent, NodeOptions } from '@sentry/nestjs';

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

export function sentryOptions(env: SentryEnv): NodeOptions | undefined {
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
    beforeBreadcrumb: withoutQuery,
  };
}

function scrubbed(event: ErrorEvent): ErrorEvent {
  const request = event.request;

  if (request) {
    request.url = withoutQueryString(request.url);
    delete request.query_string;
    delete request.cookies;
    delete request.data;

    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(
          ([name]) => !REDACTED_HEADERS.has(name.toLowerCase()),
        ),
      );
    }
  }

  if (event.user) {
    event.user =
      event.user.id === undefined ? undefined : { id: event.user.id };
  }

  event.breadcrumbs = event.breadcrumbs?.map(withoutQuery);

  return event;
}

function withoutQuery(breadcrumb: Breadcrumb): Breadcrumb {
  const url = breadcrumb.data?.url;

  if (typeof url !== 'string') {
    return breadcrumb;
  }

  return {
    ...breadcrumb,
    data: { ...breadcrumb.data, url: withoutQueryString(url) },
  };
}

function withoutQueryString<T extends string | undefined>(url: T): T {
  return (url?.split(/[?#]/, 1)[0] ?? url) as T;
}
