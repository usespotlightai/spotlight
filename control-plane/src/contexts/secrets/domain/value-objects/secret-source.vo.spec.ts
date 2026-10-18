import { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import { describe, expect, it } from 'vitest';

describe('SecretSource', () => {
  it('is read in the network where an external store holds it, and there alone', () => {
    expect(SecretSource.builtIn().externalRef).toBeNull();
    expect(
      SecretSource.awsSecretsManager({
        secretId: 'sentry-token',
        field: 'token',
      }).externalRef,
    ).toEqual({
      kind: 'aws-secrets-manager',
      secretId: 'sentry-token',
      field: 'token',
    });
  });
});
