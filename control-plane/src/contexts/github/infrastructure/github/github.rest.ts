import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';

const API = 'https://api.github.com';

const TIMEOUT_MS = 30_000;

const TOO_MANY = 429;

const FORBIDDEN = 403;

const SERVER_ERROR = 500;

interface GitHubError {
  readonly message?: string;
  readonly errors?: { readonly message?: string }[];
}

export const call = (
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> =>
  fetch(`${API}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      ...init.headers,
    },
  });

const retryable = (response: Response, body: GitHubError): boolean => {
  const headers = response.headers as Headers | undefined;
  const rateLimited =
    headers?.get?.('x-ratelimit-remaining') === '0' ||
    Boolean(headers?.get?.('retry-after')) ||
    /rate limit/i.test(body.message ?? '');

  return (
    response.status === TOO_MANY ||
    response.status >= SERVER_ERROR ||
    (response.status === FORBIDDEN && rateLimited)
  );
};

export const answered = async <T>(
  response: Response,
  operation: string,
): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & GitHubError;

  if (!response.ok) {
    throw new UpstreamError(
      operation,
      body.errors?.[0]?.message ?? body.message ?? `${response.status}`,
      response.status,
      retryable(response, body),
    );
  }

  return body;
};

export const sending = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});
