import {
  type Breadcrumb,
  type BrowserOptions,
  captureException,
  type ErrorEvent,
  init,
  setUser,
} from '@sentry/react';

import { readStored, writeStored } from '@/hooks/useStoredState';
import { type ErrorReportingResponseDto, getErrorReporting } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { isRecord } from '@/lib/record';
import { isGatewayStatus } from '@/lib/request-failure';

export class GatewayError extends Error {
  override readonly name = 'GatewayError';
}

const STORED_REPORTING_KEY = 'spotlight:error-reporting';

export async function startErrorReporting(): Promise<void> {
  const stored = storedReporting();

  if (stored) {
    start(stored);
    void fetchReporting().catch(() => undefined);
    return;
  }

  const fetched = await fetchReporting();
  if (fetched) {
    start(fetched);
  }
}

function start(reporting: ErrorReportingResponseDto): void {
  if (nonEmpty(reporting.dsn)) {
    init(errorReportingOptions(reporting));
  }
}

async function fetchReporting(): Promise<
  ErrorReportingResponseDto | undefined
> {
  const { data } = await getErrorReporting();

  if (data) {
    storeReporting(data);
  }

  return data;
}

function storedReporting(): ErrorReportingResponseDto | undefined {
  let stored: unknown;
  try {
    stored = JSON.parse(readStored(STORED_REPORTING_KEY) ?? 'null');
  } catch {
    return undefined;
  }

  return isReporting(stored) && stored.build === import.meta.env.VITE_RELEASE
    ? stored
    : undefined;
}

function storeReporting(reporting: ErrorReportingResponseDto): void {
  writeStored(
    STORED_REPORTING_KEY,
    JSON.stringify({
      build: import.meta.env.VITE_RELEASE,
      dsn: reporting.dsn,
      environment: reporting.environment,
      release: reporting.release,
    }),
  );
}

const isTextOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function isReporting(
  value: unknown,
): value is ErrorReportingResponseDto & { build: string } {
  if (!isRecord(value)) {
    return false;
  }

  const { build, dsn, environment, release } = value;
  return (
    typeof build === 'string' &&
    isTextOrNull(dsn) &&
    isTextOrNull(environment) &&
    isTextOrNull(release)
  );
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
    beforeBreadcrumb: withoutIds,
  };
}

export function reportAs(userId: string | null): void {
  setUser(nonEmpty(userId) ? { id: userId } : null);
}

export function withGatewayErrorReported(
  thrown: unknown,
  response: Response | undefined,
  request: Request | undefined,
): unknown {
  if (request && response && isGatewayStatus(response.status)) {
    captureException(new GatewayError(`API answered ${response.status}`), {
      fingerprint: ['gateway-error', String(response.status)],
      tags: { route: `${request.method} ${routeOf(request.url)}` },
    });
  }

  return thrown;
}

export function scrubbed(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.url =
      event.request.url === undefined ? undefined : urlShape(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;

    if (nonEmpty(event.request.headers?.Referer)) {
      event.request.headers.Referer = urlShape(event.request.headers.Referer);
    }
  }

  if (event.user) {
    event.user =
      event.user.id === undefined ? undefined : { id: event.user.id };
  }

  event.breadcrumbs = event.breadcrumbs?.map(withoutIds);

  return event;
}

function withoutIds(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) {
    return breadcrumb;
  }

  const data = { ...breadcrumb.data };
  for (const key of ['url', 'from', 'to']) {
    const value: unknown = data[key];
    if (typeof value === 'string') {
      data[key] = urlShape(value);
    }
  }

  return { ...breadcrumb, data };
}

function routeOf(url: string): string {
  return new URL(url, 'http://spotlight.invalid').pathname
    .split('/')
    .map((segment, at) =>
      at > 2 && at % 2 === 1 ? ':id' : shapedSegment(segment),
    )
    .join('/');
}

const WORD = /^[a-z][a-z-]{0,23}$/;

const shapedSegment = (segment: string): string =>
  segment === '' || WORD.test(segment) ? segment : ':id';

const shapedPath = (path: string): string =>
  path.split('/').map(shapedSegment).join('/');

function urlShape(url: string): string {
  if (url === '') {
    return url;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.origin}${shapedPath(parsed.pathname)}`;
  } catch {
    return shapedPath(url.split(/[?#]/, 1)[0] ?? '');
  }
}
