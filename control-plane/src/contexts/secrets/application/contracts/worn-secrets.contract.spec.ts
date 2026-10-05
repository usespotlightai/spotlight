import { inspect } from 'node:util';
import { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';
import { describe, expect, it } from 'vitest';

describe('WornSecrets', () => {
  const worn = WornSecrets.of([
    {
      carrier: 'header',
      name: 'authorization',
      value: 'Bearer lin_api_1',
      bare: 'lin_api_1',
    },
  ]);

  const keyed = WornSecrets.of([
    { carrier: 'query', name: 'key', value: 'AIza/1+2 3', bare: 'AIza/1+2 3' },
  ]);

  it('puts each header on the request, over any the request wrote', () => {
    const url = new URL('https://api.linear.app/graphql');
    const headers: Record<string, string> = {
      Authorization: 'Bearer forged',
      accept: 'application/json',
    };

    worn.applyTo({ url, headers });

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

    keyed.applyTo({ url, headers });

    expect(url.searchParams.getAll('key')).toEqual(['AIza/1+2 3']);
    expect(url.searchParams.get('address')).toBe('a b');
    expect(headers).toEqual({});
  });

  it('keeps the rest of the query as it was written', () => {
    const url = new URL(
      'https://maps.googleapis.com/geocode?address=a%20b&key=forged&flag&tilde=~x&key=again',
    );

    keyed.applyTo({ url, headers: {} });

    expect(url.search).toBe(
      '?address=a%20b&key=AIza%2F1%2B2%203&flag&tilde=~x',
    );

    const bare = new URL('https://maps.googleapis.com/geocode?flag&q=a%20b');
    keyed.applyTo({ url: bare, headers: {} });
    expect(bare.search).toBe('?flag&q=a%20b&key=AIza%2F1%2B2%203');
  });

  it('takes the secret out of text that holds it escaped for JSON', () => {
    const quoted = WornSecrets.of([
      { carrier: 'query', name: 'key', value: 'k/"1"', bare: 'k/"1"' },
    ]);

    expect(quoted.redact('{"echo":"k\\/\\"1\\""}')).toBe('{"echo":"[secret]"}');
    expect(quoted.redact('{"echo":"k/\\"1\\""}')).toBe('{"echo":"[secret]"}');
  });

  it('takes the secret out without its prefix, as a host may echo it', () => {
    expect(worn.redact('token lin_api_1 is not valid')).toBe(
      'token [secret] is not valid',
    );
    expect(keyed.redact('said AIza%2f1%2b2%203')).toBe('said [secret]');
  });

  it('takes what it wears out of text, however it was spelled', () => {
    const url = new URL('https://maps.googleapis.com/geocode?address=x');
    keyed.applyTo({ url, headers: {} });

    expect(keyed.redact(`could not reach ${url.toString()}`)).toBe(
      'could not reach https://maps.googleapis.com/geocode?address=x&key=[secret]',
    );
    expect(keyed.redact('said AIza/1+2 3 and AIza%2F1%2B2%203')).toBe(
      'said [secret] and [secret]',
    );
    expect(worn.redact('nothing worn here')).toBe('nothing worn here');
  });

  it('takes what it wears out of every string and key of an answer', () => {
    expect(
      keyed.redactedIn({
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

  it('never says what it wears', () => {
    for (const each of [worn, keyed]) {
      expect(JSON.stringify({ each })).not.toMatch(/lin_api_1|AIza/);
      expect(inspect(each)).not.toMatch(/lin_api_1|AIza/);
      expect(String(each)).not.toMatch(/lin_api_1|AIza/);
    }
  });
});
