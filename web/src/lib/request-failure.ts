export type SentRequest = {
  readonly method: string;
  readonly path: string;
  readonly status: number | null;
};

const SENT = 'sentRequest';

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

export const sentRequestOf = (thrown: unknown): SentRequest | null => {
  const sent = (thrown as Record<string, unknown> | null)?.[SENT];
  return sent && typeof sent === 'object' ? (sent as SentRequest) : null;
};

const STATUS_TEXT: Record<number, string> = {
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
  const body = thrown as { status?: unknown; statusCode?: unknown } | null;
  const status = body?.status ?? body?.statusCode;
  return typeof status === 'number' ? status : null;
};

export const failureHeadline = (thrown: unknown): string => {
  const sent = sentRequestOf(thrown);
  const status = sent?.status ?? statusOf(thrown);

  if (status !== null) {
    const body = thrown as { error?: unknown; title?: unknown } | null;
    const reason =
      STATUS_TEXT[status] ??
      (typeof body?.error === 'string' ? body.error : null) ??
      (typeof body?.title === 'string' ? body.title : null);
    return reason ? `${status} ${reason}` : `HTTP ${status}`;
  }

  if (sent) {
    return 'Network error. Control plane didn’t respond.';
  }

  return thrown instanceof Error && thrown.name !== 'Error'
    ? thrown.name
    : 'Request failed';
};
