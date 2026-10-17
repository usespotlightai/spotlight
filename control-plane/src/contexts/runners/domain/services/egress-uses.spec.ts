import {
  anEgress,
  EGRESS_ID,
} from '@runners/domain/aggregates/egress.fake-spec';
import {
  aPullPool,
  aPushPool,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { poolsNaming } from '@runners/domain/services/egress-uses';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { describe, expect, it } from 'vitest';

describe('poolsNaming', () => {
  it('finds the standing pools that name the egress, and no other', () => {
    const naming = aPushPool({ egress: EgressReference.to(EGRESS_ID) });

    expect(
      poolsNaming(anEgress(), [
        naming,
        naming.retired(attributedIn()),
        aPushPool({ egress: EgressReference.platform() }),
        aPushPool({ egress: EgressReference.to(EgressId.of('egress_2')) }),
        aPushPool(),
        aPullPool(),
      ]).map((each) => each.value),
    ).toEqual(['sandboxes']);
  });
});
