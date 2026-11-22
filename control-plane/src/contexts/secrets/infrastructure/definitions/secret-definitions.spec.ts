import { SecretDefinitions } from '@secrets/infrastructure/definitions/secret-definitions';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const definitions = new SecretDefinitions();

const problemsAt = (input: unknown) => {
  const read = definitions.secret(input);

  return read.ok ? [] : read.problems.map((each) => dottedOf(each.field));
};

describe('SecretDefinitions', () => {
  it('reads a secret Spotlight stores, with its value and bindings', () => {
    const read = definitions.secret({
      name: 'LINEAR_API_KEY',
      bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
      valueWo: 'lin_api_1',
      valueWoVersion: 1,
    });

    expect(read.ok && read.value?.revealed()).toBe('lin_api_1');
    expect(read.ok && read.valueVersion?.value).toBe(1);
    expect(read.ok && read.bindings.hosts).toEqual(['api.linear.app']);
  });

  it('points at each field that is wrong', () => {
    expect(problemsAt({ name: 'linear key' })).toEqual(['name']);
    expect(
      problemsAt({ name: 'LINEAR_API_KEY', bindings: [{ host: 'a b' }] }),
    ).toEqual(['bindings.0.host']);
    expect(problemsAt({ name: 'LINEAR_API_KEY', valueWoVersion: 1.5 })).toEqual(
      ['valueWoVersion'],
    );
  });

  it('keeps a secret’s value out of sandboxes unless it says env, and refuses any other sandbox', () => {
    const read = definitions.secret({ name: 'LINEAR_API_KEY' });
    const env = definitions.secret({ name: 'LINEAR_API_KEY', sandbox: 'env' });
    const other = definitions.secret({
      name: 'LINEAR_API_KEY',
      sandbox: 'file',
    });

    expect(read.ok && read.sandbox).toBe('stand-in');
    expect(env.ok && env.sandbox).toBe('env');
    expect(
      other.ok
        ? []
        : other.problems.map((each) => [dottedOf(each.field), each.reason]),
    ).toEqual([['sandbox', 'is stand-in or env']]);
  });

  it('never repeats a value it rejects', () => {
    const read = definitions.secret({
      name: 'LINEAR_API_KEY',
      valueWo: 'x'.repeat(70_000),
    });

    expect(read.ok).toBe(false);
    expect(JSON.stringify(read)).not.toContain('x'.repeat(100));
  });

  it('refuses a name that Spotlight keeps for its own secrets', () => {
    expect(
      problemsAt({ name: 'SPOTLIGHT_GITHUB_KEY', valueWo: 'sk-1' }),
    ).toEqual(['name']);
  });
});
