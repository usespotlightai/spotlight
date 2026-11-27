import { fieldOf } from '@platform/json/field-of';
import { itemAt } from '@shared-kernel/domain/item-at';

export const callAt = <A extends readonly unknown[]>(
  called: { readonly mock: { readonly calls: readonly A[] } },
  index = 0,
): A => {
  const call = itemAt(called.mock.calls, index);

  if (call === undefined) {
    throw new Error(`expected call ${index}`);
  }

  return call;
};

export const headersOf = (
  init: RequestInit | undefined,
): Readonly<Record<string, string>> => {
  const headers = init?.headers;

  if (headers === undefined) {
    return {};
  }

  if (headers instanceof Headers || Array.isArray(headers)) {
    return Object.fromEntries(new Headers(headers));
  }

  return headers;
};

export const bodyOf = (init: RequestInit | undefined): string => {
  const body = init?.body;

  if (typeof body !== 'string') {
    throw new Error('expected a text body');
  }

  return body;
};

export const errorOf = (thrown: unknown): Error => {
  if (!(thrown instanceof Error)) {
    throw new Error('expected an Error');
  }

  return thrown;
};

export const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

export const valueAt = (value: unknown, ...path: readonly string[]): unknown =>
  path.reduce<unknown>((within, key) => fieldOf(within, key), value);
