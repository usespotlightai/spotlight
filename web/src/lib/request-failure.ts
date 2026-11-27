import { nonEmpty } from '@/lib/non-empty';
import { fieldOf, isRecord } from '@/lib/record';

export type SentRequest = {
  readonly method: string;
  readonly path: string;
  readonly status: number | null;
};

const SENT = 'sentRequest';

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export const isGatewayStatus = (status: number): boolean =>
  GATEWAY_STATUSES.has(status);

const pathOf = (url: string): string => {
  try {
    const { pathname, search } = new URL(url, window.location.origin);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
};

export const withSentRequest = (
  thrown: unknown,
  response: Response | undefined,
  request: Request | undefined,
): unknown => {
  if (!request) {
    return thrown;
  }

  const sent: SentRequest = {
    method: request.method,
    path: pathOf(request.url),
    status: response?.status ?? null,
  };
  const failure =
    typeof thrown === 'object' && thrown !== null
      ? thrown
      : { message: typeof thrown === 'string' ? thrown : undefined };

  return Object.assign(failure, { [SENT]: sent });
};

const isSentRequest = (value: unknown): value is SentRequest =>
  isRecord(value) &&
  typeof value.method === 'string' &&
  typeof value.path === 'string' &&
  (typeof value.status === 'number' || value.status === null);

export const sentRequestOf = (thrown: unknown): SentRequest | null => {
  const sent = fieldOf(thrown, SENT);
  return isSentRequest(sent) ? sent : null;
};

const STATUS_TEXT: Partial<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Content Too Large',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const statusOf = (thrown: unknown): number | null => {
  const status = fieldOf(thrown, 'status') ?? fieldOf(thrown, 'statusCode');
  return typeof status === 'number' ? status : null;
};

export const failureHeadline = (thrown: unknown): string => {
  const sent = sentRequestOf(thrown);
  const status = sent?.status ?? statusOf(thrown);

  if (status !== null) {
    const error = fieldOf(thrown, 'error');
    const title = fieldOf(thrown, 'title');
    const reason =
      STATUS_TEXT[status] ??
      (typeof error === 'string' ? error : null) ??
      (typeof title === 'string' ? title : null);
    return nonEmpty(reason) ? `${status} ${reason}` : `HTTP ${status}`;
  }

  if (sent) {
    return 'Network error. Control plane didn’t respond.';
  }

  return thrown instanceof Error && thrown.name !== 'Error'
    ? thrown.name
    : 'Request failed';
};
