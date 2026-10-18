import { danglingKeysBetween } from '@runners/domain/services/dangling-keys';
import { describe, expect, it } from 'vitest';

describe('danglingKeysBetween', () => {
  it('names the trusts and pools a declaration names that the workspace does not have', () => {
    const dangling = danglingKeysBetween(
      {
        trusts: ['production', 'staging'],
        pools: ['ephemeral', 'sandboxes'],
      },
      {
        trusts: ['production'],
        pools: ['ephemeral'],
      },
    );

    expect(dangling).toEqual({
      unknownTrusts: ['staging'],
      unknownPools: ['sandboxes'],
    });
  });

  it('finds no dangling keys when the workspace has everything the declaration names', () => {
    expect(
      danglingKeysBetween(
        { trusts: ['production'], pools: [] },
        { trusts: ['production', 'staging'], pools: ['ephemeral'] },
      ),
    ).toEqual({ unknownTrusts: [], unknownPools: [] });
  });
});
