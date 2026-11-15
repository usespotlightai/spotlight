import type { ClaimsRevision } from '@insights/domain/aggregates/claims-revision.aggregate';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface ClaimsRevisionRepository extends ScopedRemoval<ClaimsRevision> {
  add(revision: ClaimsRevision): Promise<void>;

  save(revision: ClaimsRevision): Promise<void>;

  find(id: ClaimsRevisionId): Promise<ClaimsRevision | null>;

  latestAt(stationId: StationId): Promise<ClaimsRevision | null>;

  nextDueJob(now: Date): Promise<ClaimsRevision | null>;

  pickedBefore(pickedAt: Date, max: number): Promise<readonly ClaimsRevision[]>;
}
