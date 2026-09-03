import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';

export const API = 'https://api.github.com';

/** What GitHub says went wrong, where it says anything worth repeating. */
interface Refusal {
  readonly message?: string;
  readonly errors?: { readonly message?: string }[];
}

/**
 * One call to GitHub's REST API as an installation. Nothing here decides what
 * to do about a refusal: the caller knows what it was asking for, and that is
 * the half of the sentence worth reading.
 */
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

/**
 * The body of a call that worked, or a refusal naming what was being asked.
 * GitHub puts the useful part in `errors` and the generic part in `message`,
 * so the first of those wins.
 */
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

/** Sent as JSON, which is all of this API that Spotlight writes to. */
export const sending = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});
