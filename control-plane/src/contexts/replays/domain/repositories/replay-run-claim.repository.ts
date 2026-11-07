import type { ReplayRunClaim } from '@replays/domain/aggregates/replay-run-claim.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunClaimRepository {
  find(runId: RunId): Promise<ReplayRunClaim | null>;

  add(claim: ReplayRunClaim): Promise<void>;

  save(claim: ReplayRunClaim): Promise<void>;
}
