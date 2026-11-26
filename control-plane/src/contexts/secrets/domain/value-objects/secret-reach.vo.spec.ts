import { SecretBindings } from '@secrets/domain/value-objects/secret-bindings.vo';
import { SecretReach } from '@secrets/domain/value-objects/secret-reach.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import { describe, expect, it } from 'vitest';

const USED = SecretUses.of([
  { kind: 'harness-profile', key: 'core/default', exposes: false },
]);

const BOUND = SecretBindings.of([{ host: 'httpbin.org' }]);

const WORKSPACE = { harnessKeys: ['ANTHROPIC_API_KEY'], egressRunners: true };

const reachOf = (
  secret: {
    name?: string;
    uses?: SecretUses;
    bindings?: SecretBindings;
  },
  workspace: { harnessKeys?: readonly string[]; egressRunners?: boolean } = {},
) =>
  SecretReach.of(
    {
      name: secret.name ?? 'HTTPBIN_TEST_TOKEN',
      uses: secret.uses ?? USED,
      bindings: secret.bindings ?? BOUND,
    },
    { ...WORKSPACE, ...workspace },
  );

describe('SecretReach', () => {
  it('is used by runs only through a harness profile or integration that names the secret', () => {
    expect(reachOf({ uses: USED }).usedByRuns).toBe(true);
    expect(reachOf({ uses: SecretUses.none() }).usedByRuns).toBe(false);
  });

  it('is used by runs with no use when it is a harness key or one of Spotlight’s own secrets', () => {
    expect(
      reachOf({ name: 'ANTHROPIC_API_KEY', uses: SecretUses.none() })
        .usedByRuns,
    ).toBe(true);
    expect(
      reachOf(
        { name: 'SPOTLIGHT_API_TOKEN', uses: SecretUses.none() },
        { harnessKeys: [] },
      ).usedByRuns,
    ).toBe(true);
  });

  it('is deliverable at its hosts only while a runner of the workspace has egress', () => {
    expect(reachOf({}, { egressRunners: true }).deliverable).toBe(true);
    expect(reachOf({}, { egressRunners: false }).deliverable).toBe(false);
    expect(
      reachOf({ bindings: SecretBindings.none() }, { egressRunners: false })
        .deliverable,
    ).toBe(true);
  });

  it('answers each question on its own, so a secret can be both unused and undeliverable', () => {
    const neither = reachOf(
      { uses: SecretUses.none() },
      { egressRunners: false },
    );

    expect([neither.usedByRuns, neither.deliverable]).toEqual([false, false]);

    const usedButStuck = reachOf({}, { egressRunners: false });

    expect([usedButStuck.usedByRuns, usedButStuck.deliverable]).toEqual([
      true,
      false,
    ]);

    const deliverableButUnused = reachOf({ uses: SecretUses.none() });

    expect([
      deliverableButUnused.usedByRuns,
      deliverableButUnused.deliverable,
    ]).toEqual([false, true]);
  });
});
