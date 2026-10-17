import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { describe, expect, it } from 'vitest';

const refusedAt = (inputs: Parameters<typeof SecretBindings.of>[0]) => {
  try {
    SecretBindings.of(inputs);
  } catch (error) {
    if (error instanceof InvalidSecretError) {
      return error.field.segments;
    }

    throw error;
  }

  return null;
};

describe('SecretBindings', () => {
  it('is injected in authorization with no prefix unless it says otherwise', () => {
    const [binding] = SecretBindings.of([{ host: 'API.Linear.app' }]).all;

    expect(binding).toMatchObject({
      host: 'api.linear.app',
      target: { location: 'header', name: 'authorization' },
      prefix: '',
    });
  });

  it('is injected in a query parameter it names, keeping the name’s case', () => {
    const [binding] = SecretBindings.of([
      { host: 'maps.googleapis.com', location: 'query', name: 'apiKey' },
    ]).all;

    expect(binding?.target).toMatchObject({
      location: 'query',
      name: 'apiKey',
    });
  });

  it('refuses a query location with no parameter, or one no URL can spell plainly', () => {
    for (const name of [undefined, '', 'api key', 'key=1', 'k&x', 'ключ']) {
      expect(
        refusedAt([{ host: 'maps.googleapis.com', location: 'query', name }]),
        String(name),
      ).toEqual(['bindings', 0, 'name']);
    }
  });

  it('refuses a location that is neither a header nor a query parameter', () => {
    expect(
      refusedAt([{ host: 'api.linear.app', location: 'cookie', name: 'k' }]),
    ).toEqual(['bindings', 0, 'location']);
  });

  it('finds the binding for a URL by its exact host', () => {
    const bindings = SecretBindings.of([
      { host: 'api.linear.app', name: 'X-Api-Key' },
    ]);

    expect(
      bindings.forUrl(new URL('https://api.linear.app/graphql'))?.target.name,
    ).toBe('x-api-key');
    expect(bindings.forUrl(new URL('https://linear.app/'))).toBeNull();
  });

  it('refuses a host written as a URL, with a port, or as a pattern', () => {
    for (const host of [
      'https://api.linear.app',
      'api.linear.app:443',
      'api.linear.app/graphql',
      '*.linear.app',
      'localhost',
      '',
    ]) {
      expect(refusedAt([{ host }]), host).toEqual(['bindings', 0, 'host']);
    }
  });

  it('refuses a header that is not one, or that frames the request', () => {
    for (const name of ['x api key', 'host', 'Content-Length', 'x-\nkey']) {
      expect(refusedAt([{ host: 'api.linear.app', name }]), name).toEqual([
        'bindings',
        0,
        'name',
      ]);
    }
  });

  it('refuses a prefix that could break the header', () => {
    expect(
      refusedAt([{ host: 'api.linear.app', prefix: 'Bearer\r\nx-evil: ' }]),
    ).toEqual(['bindings', 0, 'prefix']);
  });

  it('binds each host once', () => {
    expect(
      refusedAt([{ host: 'api.linear.app' }, { host: 'API.linear.app' }]),
    ).toEqual(['bindings', 1, 'host']);
  });

  it('is the same bindings as another written the same', () => {
    const one = SecretBindings.of([{ host: 'a.example', prefix: 'Bearer ' }]);

    expect(
      one.equals(SecretBindings.of([{ host: 'a.example', prefix: 'Bearer ' }])),
    ).toBe(true);
    expect(one.equals(SecretBindings.of([{ host: 'a.example' }]))).toBe(false);
    expect(
      one.equals(
        SecretBindings.of([
          { host: 'a.example', location: 'query', name: 'authorization' },
        ]),
      ),
    ).toBe(false);
  });
});
