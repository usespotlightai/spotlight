import type { RequestHeaders } from '@platform/http/request-headers';
import { firstOf, itemAt } from '@shared-kernel/domain/item-at';

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
    firstOf(entries(request.headers['cf-connecting-ip'])) ??
    itemAt(forwarded, forwarded.length - 1) ??
    request.ip ??
    'unknown'
  );
};
