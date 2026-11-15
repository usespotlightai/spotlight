import type { ClaimsSource } from '@insights/domain/aggregates/claims-source.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface ClaimsSourceRepository extends ScopedRemoval<ClaimsSource> {
  find(
    stationId: StationId,
    rubricVersion: RubricVersion,
  ): Promise<ClaimsSource | null>;

  ofStation(stationId: StationId): Promise<readonly ClaimsSource[]>;

  nextDueJob(now: Date): Promise<ClaimsSource | null>;

  add(source: ClaimsSource): Promise<void>;

  save(source: ClaimsSource): Promise<void>;
}
