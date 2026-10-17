import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const EGRESS_FIELD = 'provision.egress';

export const validateEgress = (
  reference: EgressReference | null,
  input: {
    readonly workspaceId: WorkspaceId;
    readonly named: Egress | null;
    readonly platformKept: boolean;
  },
): void => {
  if (!reference) {
    return;
  }

  if (reference.isPlatform) {
    if (!input.platformKept) {
      throw new InvalidRunnerPoolError(
        EGRESS_FIELD,
        `names ${reference.value}. This deployment has no platform egress. Please name an egress of this workspace, or leave provision.egress out`,
      );
    }

    return;
  }

  const { named } = input;

  if (
    !named ||
    named.isRetired ||
    !named.belongsTo(input.workspaceId) ||
    !reference.egressId?.equals(named.id)
  ) {
    throw new InvalidRunnerPoolError(
      EGRESS_FIELD,
      `names ${reference.value}. Egress ${reference.value} doesn't exist in this workspace`,
    );
  }
};
