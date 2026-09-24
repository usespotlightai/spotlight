import { driftBetween } from '@runners/domain/services/runner-drift';
import { describe, expect, it } from 'vitest';

describe('driftBetween', () => {
  it('counts as drift every runner neither named nor enrolled through a named trust', () => {
    expect(
      driftBetween(
        { runners: ['build-1'], trusts: ['production'] },
        {
          runners: [
            { name: 'build-1', trustKey: null },
            { name: 'pod-a', trustKey: 'production' },
            { name: 'laptop', trustKey: null },
            { name: 'pod-b', trustKey: 'staging' },
          ],
          trusts: ['production', 'staging'],
        },
      ).undeclared,
    ).toEqual(['laptop', 'pod-b']);
  });

  it('names the runners and trusts a declaration names that the workspace does not have', () => {
    const drift = driftBetween(
      { runners: ['build-1', 'build-2'], trusts: ['production', 'staging'] },
      {
        runners: [{ name: 'build-1', trustKey: null }],
        trusts: ['production'],
      },
    );

    expect(drift.unknownRunners).toEqual(['build-2']);
    expect(drift.unknownTrusts).toEqual(['staging']);
  });
});
