import {
  aPullPool,
  aPushPool,
  aTrust,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { injectsSecrets } from '@runners/domain/services/injects-secrets';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { describe, expect, it } from 'vitest';

const SET = { platformPoolSet: true, platformEgressSet: true };

describe('injectsSecrets', () => {
  it('finds a runner that injects secrets in a pool hosts pull from, a trust, or a push pool with egress', () => {
    expect(injectsSecrets([aPullPool()], [], SET)).toBe(true);
    expect(injectsSecrets([aPushPool()], [aTrust()], SET)).toBe(true);
    expect(
      injectsSecrets(
        [aPushPool(), aPushPool({ egress: EgressReference.platform() })],
        [],
        SET,
      ),
    ).toBe(true);
  });

  it('finds none in push pools without egress, a deleted trust, or no pool at all', () => {
    expect(injectsSecrets([], [], SET)).toBe(false);
    expect(
      injectsSecrets([aPushPool()], [aTrust().delete(changeActorIn())], SET),
    ).toBe(false);
  });
});
