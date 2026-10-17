import { SecretDefinitions } from '@secrets/infrastructure/definitions/secret-definitions';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const definitions = new SecretDefinitions();

const problemsAt = (input: unknown) => {
  const read = definitions.secret(input);

  return read.ok ? [] : read.problems.map((each) => dottedOf(each.field));
};

describe('SecretDefinitions', () => {
  it('reads a secret Spotlight keeps, with its value and bindings', () => {
    const read = definitions.secret({
      name: 'LINEAR_API_KEY',
      bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
      valueWo: 'lin_api_1',
      valueWoVersion: 1,
    });

    expect(read.ok && read.source.kind).toBe('built-in');
    expect(read.ok && read.value?.revealed()).toBe('lin_api_1');
    expect(read.ok && read.valueVersion).toBe(1);
    expect(read.ok && read.bindings.hosts).toEqual(['api.linear.app']);
  });

  it('reads a secret that AWS Secrets Manager keeps', () => {
    const read = definitions.secret({
      name: 'LINEAR_API_KEY',
      source: {
        kind: 'aws-secrets-manager',
        secretId: 'arn:aws:secretsmanager:eu-west-1:1:secret:linear',
        field: 'token',
      },
    });

    expect(read.ok && read.source).toMatchObject({
      kind: 'aws-secrets-manager',
      field: 'token',
    });
    expect(read.ok && read.value).toBeNull();
  });

  it('points at each field that is wrong', () => {
    expect(problemsAt({ name: 'linear key' })).toEqual(['name']);
    expect(
      problemsAt({ name: 'LINEAR_API_KEY', bindings: [{ host: 'a b' }] }),
    ).toEqual(['bindings.0.host']);
    expect(problemsAt({ name: 'LINEAR_API_KEY', valueWoVersion: 1.5 })).toEqual(
      ['valueWoVersion'],
    );
    expect(
      problemsAt({
        name: 'LINEAR_API_KEY',
        source: { kind: 'aws-secrets-manager', secretId: 'has space' },
      }),
    ).toEqual(['source.secretId']);
  });

  it('never repeats a value it rejects', () => {
    const read = definitions.secret({
      name: 'LINEAR_API_KEY',
      valueWo: 'x'.repeat(70_000),
    });

    expect(read.ok).toBe(false);
    expect(JSON.stringify(read)).not.toContain('x'.repeat(100));
  });
});
