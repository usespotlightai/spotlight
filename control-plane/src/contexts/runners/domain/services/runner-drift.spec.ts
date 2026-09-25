import { driftBetween } from '@runners/domain/services/runner-drift';
import { describe, expect, it } from 'vitest';

describe('driftBetween', () => {
  it('names the trusts and pools a declaration names that the workspace does not have', () => {
    const drift = driftBetween(
      {
        trusts: ['production', 'staging'],
        pools: ['ephemeral', 'sandboxes'],
      },
      {
        trusts: ['production'],
        pools: ['ephemeral'],
      },
    );

    expect(drift).toEqual({
      unknownTrusts: ['staging'],
      unknownPools: ['sandboxes'],
    });
  });

  it('finds no drift when the workspace has everything the declaration names', () => {
    expect(
      driftBetween(
        { trusts: ['production'], pools: [] },
        { trusts: ['production', 'staging'], pools: ['ephemeral'] },
      ),
    ).toEqual({ unknownTrusts: [], unknownPools: [] });
  });
});
