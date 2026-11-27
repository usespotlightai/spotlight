import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const EGRESS_FIELD = 'provision.egress';

export type EgressAvailability =
  | 'available'
  | 'no-platform-egress'
  | 'not-in-workspace';

export interface EgressCandidate {
  readonly workspaceId: WorkspaceId;
  readonly named: Egress | null;
  readonly platformStored: boolean;
}

export const egressAvailability = (
  reference: EgressReference,
  candidate: EgressCandidate,
): EgressAvailability => {
  if (reference.isPlatform) {
    return reference.usableWith(candidate.platformStored)
      ? 'available'
      : 'no-platform-egress';
  }

  const { named } = candidate;

  return named &&
    !named.isDeleted &&
    named.belongsTo(candidate.workspaceId) &&
    reference.egressId?.equals(named.id)
    ? 'available'
    : 'not-in-workspace';
};

export const validateEgress = (
  reference: EgressReference | null,
  candidate: EgressCandidate,
): void => {
  if (!reference) {
    return;
  }

  const availability = egressAvailability(reference, candidate);

  if (availability === 'no-platform-egress') {
    throw new InvalidRunnerPoolError(
      EGRESS_FIELD,
      `names ${reference.value}. This deployment has no platform egress. Please name an egress of this workspace, or leave provision.egress out`,
    );
  }

  if (availability === 'not-in-workspace') {
    throw new InvalidRunnerPoolError(
      EGRESS_FIELD,
      `names ${reference.value}. Egress ${reference.value} doesn't exist in this workspace`,
    );
  }
};
