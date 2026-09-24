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
  it('is worn in authorization with no prefix unless it says otherwise', () => {
    const [binding] = SecretBindings.of([{ host: 'API.Linear.app' }]).all;

    expect(binding).toMatchObject({
      host: 'api.linear.app',
      header: 'authorization',
      prefix: '',
    });
  });

  it('finds the binding toward a URL by its exact host', () => {
    const bindings = SecretBindings.of([
      { host: 'api.linear.app', header: 'X-Api-Key' },
    ]);

    expect(
      bindings.toward(new URL('https://api.linear.app/graphql'))?.header,
    ).toBe('x-api-key');
    expect(bindings.toward(new URL('https://linear.app/'))).toBeNull();
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
    for (const header of ['x api key', 'host', 'Content-Length', 'x-\nkey']) {
      expect(refusedAt([{ host: 'api.linear.app', header }]), header).toEqual([
        'bindings',
        0,
        'header',
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
  });
});
