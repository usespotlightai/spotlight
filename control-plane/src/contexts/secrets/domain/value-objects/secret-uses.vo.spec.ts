import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { describe, expect, it } from 'vitest';

const HARNESS_KEYS = ['ANTHROPIC_API_KEY'];

describe('SecretUses', () => {
  it('reaches runs only through a harness profile or integration that names the secret', () => {
    expect(
      SecretUses.of([
        { kind: 'harness-profile', key: 'core/default', exposes: false },
      ]).reachesRuns('HTTPBIN_TEST_TOKEN', HARNESS_KEYS),
    ).toBe(true);
    expect(
      SecretUses.none().reachesRuns('HTTPBIN_TEST_TOKEN', HARNESS_KEYS),
    ).toBe(false);
  });

  it('reaches runs with no use when it is a harness key or one of Spotlight’s own secrets', () => {
    expect(
      SecretUses.none().reachesRuns('ANTHROPIC_API_KEY', HARNESS_KEYS),
    ).toBe(true);
    expect(SecretUses.none().reachesRuns('SPOTLIGHT_API_TOKEN', [])).toBe(true);
  });
});
