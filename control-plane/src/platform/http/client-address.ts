import type { RequestHeaders } from '@shared-kernel/application/ports/session.port';

type AddressedRequest = {
  readonly headers: RequestHeaders;
  readonly ip?: string;
};

const entries = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value.join(',') : (value ?? ''))
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export const clientAddress = (request: AddressedRequest): string => {
  const forwarded = entries(request.headers['x-forwarded-for']);

  return (
    entries(request.headers['cf-connecting-ip'])[0] ??
    forwarded[forwarded.length - 1] ??
    request.ip ??
    'unknown'
  );
};
