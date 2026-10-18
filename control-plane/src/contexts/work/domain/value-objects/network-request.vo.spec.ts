import { isSecret } from '@shared-kernel/domain/value-objects/secret';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { describe, expect, it } from 'vitest';

const signed = (body = new Uint8Array([1, 2, 3])) =>
  NetworkRequest.of({
    method: 'post',
    url: 'https://api.github.com/graphql',
    headers: { authorization: 'Bearer ghs_token' },
    body,
    timeoutMs: 5_000,
  });

describe('NetworkRequest', () => {
  it('keeps its own copy of what it was bytes, and hands out copies', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const request = signed(bytes);

    bytes[0] = 9;
    request.body[1] = 9;
    (request.headers as Record<string, string>).authorization = 'Bearer other';

    expect([...request.body]).toEqual([1, 2, 3]);
    expect(request.headers).toEqual({ authorization: 'Bearer ghs_token' });
  });

  it('is the same request as another with the same method, address, headers and body', () => {
    expect(signed().equals(signed())).toBe(true);
    expect(signed().equals(signed(new Uint8Array([1, 2])))).toBe(false);
    expect(signed().equals(signed().spent())).toBe(false);
  });

  it('is a secret, for the bearer tokens its headers carry', () => {
    expect(isSecret(signed())).toBe(true);
  });
});
