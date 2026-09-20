import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';

const API = 'https://api.github.com';

interface Refusal {
  readonly message?: string;
  readonly errors?: { readonly message?: string }[];
}

export const call = (
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> =>
  fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      ...init.headers,
    },
  });

export const answered = async <T>(
  response: Response,
  asking: string,
): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & Refusal;

  if (!response.ok) {
    throw new UpstreamRefusedError(
      asking,
      body.errors?.[0]?.message ?? body.message ?? `${response.status}`,
    );
  }

  return body;
};

export const sending = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});
