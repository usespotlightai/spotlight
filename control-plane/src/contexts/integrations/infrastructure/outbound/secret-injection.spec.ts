import { inspect } from 'node:util';
import {
  applyInjected,
  redactInjected,
  redactInjectedIn,
} from '@integrations/infrastructure/outbound/secret-injection';
import { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import { describe, expect, it } from 'vitest';

describe('secret injection', () => {
  const headerSecret = InjectedSecrets.of([
    {
      location: 'header',
      name: 'authorization',
      value: 'Bearer lin_api_1',
      bare: 'lin_api_1',
    },
  ]);

  const keyed = InjectedSecrets.of([
    { location: 'query', name: 'key', value: 'AIza/1+2 3', bare: 'AIza/1+2 3' },
  ]);

  it('puts each header on the request, over any the request wrote', () => {
    const url = new URL('https://api.linear.app/graphql');
    const headers: Record<string, string> = {
      Authorization: 'Bearer forged',
      accept: 'application/json',
    };

    applyInjected(headerSecret, { url, headers });

    expect(headers).toEqual({
      authorization: 'Bearer lin_api_1',
      accept: 'application/json',
    });
    expect(url.search).toBe('');
  });

  it('puts a query secret in its parameter, over one the request wrote', () => {
    const url = new URL(
      'https://maps.googleapis.com/geocode?address=a%20b&key=forged&key=again',
    );
    const headers: Record<string, string> = {};

    applyInjected(keyed, { url, headers });

    expect(url.searchParams.getAll('key')).toEqual(['AIza/1+2 3']);
    expect(url.searchParams.get('address')).toBe('a b');
    expect(headers).toEqual({});
  });

  it('keeps the rest of the query as it was written', () => {
    const url = new URL(
      'https://maps.googleapis.com/geocode?address=a%20b&key=forged&flag&tilde=~x&key=again',
    );

    applyInjected(keyed, { url, headers: {} });

    expect(url.search).toBe(
      '?address=a%20b&key=AIza%2F1%2B2%203&flag&tilde=~x',
    );

    const bare = new URL('https://maps.googleapis.com/geocode?flag&q=a%20b');
    applyInjected(keyed, { url: bare, headers: {} });
    expect(bare.search).toBe('?flag&q=a%20b&key=AIza%2F1%2B2%203');
  });

  it('takes the secret out of text that contains it escaped for JSON', () => {
    const quoted = InjectedSecrets.of([
      { location: 'query', name: 'key', value: 'k/"1"', bare: 'k/"1"' },
    ]);

    expect(redactInjected(quoted, '{"echo":"k\\/\\"1\\""}')).toBe(
      '{"echo":"[secret]"}',
    );
    expect(redactInjected(quoted, '{"echo":"k/\\"1\\""}')).toBe(
      '{"echo":"[secret]"}',
    );
  });

  it('takes the secret out without its prefix, as a host may echo it', () => {
    expect(redactInjected(headerSecret, 'token lin_api_1 is not valid')).toBe(
      'token [secret] is not valid',
    );
    expect(redactInjected(keyed, 'said AIza%2f1%2b2%203')).toBe(
      'said [secret]',
    );
  });

  it('takes what it injects out of text, however it was spelled', () => {
    const url = new URL('https://maps.googleapis.com/geocode?address=x');
    applyInjected(keyed, { url, headers: {} });

    expect(redactInjected(keyed, `could not reach ${url.toString()}`)).toBe(
      'could not reach https://maps.googleapis.com/geocode?address=x&key=[secret]',
    );
    expect(redactInjected(keyed, 'said AIza/1+2 3 and AIza%2F1%2B2%203')).toBe(
      'said [secret] and [secret]',
    );
    expect(redactInjected(headerSecret, 'nothing secret here')).toBe(
      'nothing secret here',
    );
  });

  it('takes what it injects out of every string and key of an answer', () => {
    expect(
      redactInjectedIn(keyed, {
        error: { message: 'key AIza/1+2 3 is not valid', code: 400 },
        echoed: ['AIza%2F1%2B2%203', null, true],
        'AIza/1+2 3': 1,
      }),
    ).toEqual({
      error: { message: 'key [secret] is not valid', code: 400 },
      echoed: ['[secret]', null, true],
      '[secret]': 1,
    });
  });

  it('never says what it injects', () => {
    for (const each of [headerSecret, keyed]) {
      expect(JSON.stringify({ each })).not.toMatch(/lin_api_1|AIza/);
      expect(inspect(each)).not.toMatch(/lin_api_1|AIza/);
      expect(String(each)).not.toMatch(/lin_api_1|AIza/);
    }
  });
});
