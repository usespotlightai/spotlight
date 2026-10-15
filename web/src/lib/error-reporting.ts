import {
  type Breadcrumb,
  type BrowserOptions,
  captureException,
  type ErrorEvent,
  init,
  setUser,
} from '@sentry/react';
import { type ErrorReportingResponseDto, getErrorReporting } from '@/lib/api';

const GATEWAY_FAULTS = new Set([502, 503, 504]);

export class ServerFault extends Error {
  override readonly name = 'ServerFault';
}

export async function startErrorReporting(): Promise<void> {
  const { data } = await getErrorReporting();

  if (data?.dsn) {
    init(errorReportingOptions(data));
  }
}

export function errorReportingOptions(
  reporting: ErrorReportingResponseDto,
): BrowserOptions {
  return {
    dsn: reporting.dsn ?? undefined,
    environment: reporting.environment ?? undefined,
    release: reporting.release ?? undefined,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: scrubbed,
    beforeBreadcrumb: withoutQuery,
  };
}

export function reportAs(userId: string | null): void {
  setUser(userId ? { id: userId } : null);
}

export function withServerFaultReported(
  thrown: unknown,
  response: Response | undefined,
  request: Request | undefined,
): unknown {
  if (request && response && GATEWAY_FAULTS.has(response.status)) {
    const path = routeOf(request.url);

    captureException(
      new ServerFault(`${request.method} ${path} answered ${response.status}`),
      { fingerprint: ['server-fault', request.method, path] },
    );
  }

  return thrown;
}

export function scrubbed(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.url = withoutQueryString(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;

    if (event.request.headers?.Referer) {
      event.request.headers.Referer = withoutQueryString(
        event.request.headers.Referer,
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
  if (!breadcrumb.data) {
    return breadcrumb;
  }

  const data = { ...breadcrumb.data };
  for (const key of ['url', 'from', 'to']) {
    if (typeof data[key] === 'string') {
      data[key] = withoutQueryString(data[key]);
    }
  }

  return { ...breadcrumb, data };
}

function routeOf(url: string): string {
  return new URL(url, 'http://spotlight.invalid').pathname
    .split('/')
    .map((segment, at) => (at > 2 && at % 2 === 1 ? ':id' : segment))
    .join('/');
}

function withoutQueryString<T extends string | undefined>(url: T): T {
  return (url?.split(/[?#]/, 1)[0] ?? url) as T;
}
