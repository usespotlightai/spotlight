import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { describe, expect, it } from 'vitest';

describe('Dependents', () => {
  it('names each dependent by its kind and key, in order', () => {
    expect(
      Dependents.of([
        { kind: 'runner-pool', key: 'ephemeral' },
        { kind: 'harness-profile', key: 'careful' },
        { kind: 'oidc-trust', key: 'github-main' },
        { kind: 'issued-tokens', key: 'github-main' },
      ]).described,
    ).toEqual([
      'OIDC trust github-main',
      'harness profile careful',
      'runner pool ephemeral',
      'tokens issued by github-main',
    ]);
  });

  it('names a dependent its source gives no key by its kind alone', () => {
    expect(
      Dependents.of([{ kind: 'workspace-runners', key: null }]).described,
    ).toEqual(['workspace runners']);
  });

  it('names a kind of another context as its source spells it', () => {
    expect(
      Dependents.of([{ kind: 'replay-search', key: 'nightly' }]).described,
    ).toEqual(['replay search nightly']);
  });

  it('is empty only with no dependent from either side', () => {
    expect(Dependents.none().and(Dependents.none()).isEmpty).toBe(true);
    expect(
      Dependents.none().and(Dependents.of([{ kind: 'secret', key: 'A' }]))
        .isEmpty,
    ).toBe(false);
  });
});
