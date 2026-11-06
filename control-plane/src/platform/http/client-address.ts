import type { RequestHeaders } from '@shared-kernel/application/ports/session.port';

type AddressedRequest = {
  readonly headers: RequestHeaders;
  readonly ip?: string;
};

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim() || undefined;

export const clientAddress = (request: AddressedRequest): string =>
  first(request.headers['cf-connecting-ip']) ??
  first(request.headers['x-forwarded-for']) ??
  request.ip ??
  'unknown';
