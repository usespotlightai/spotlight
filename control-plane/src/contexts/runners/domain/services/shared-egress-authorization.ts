import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { EgressAvailability } from '@runners/domain/services/egress-naming';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';

export const authorizesSharedEgress = (input: {
  readonly runner: Runner;
  readonly pool: RunnerPool | null;
  readonly through: EgressReference;
  readonly availability: EgressAvailability;
}): boolean =>
  (input.pool?.belongsTo(input.runner.workspaceId) ?? false) &&
  (input.pool?.usesEgress(input.through) ?? false) &&
  input.availability === 'available';
