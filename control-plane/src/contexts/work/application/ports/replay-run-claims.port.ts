import type { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';

export const REPLAY_RUN_CLAIMS = Symbol('REPLAY_RUN_CLAIMS');

export interface ReplayRunClaimsPort {
  claim(first: ReplayRunClaim): Promise<ReplayRunClaim>;

  save(claim: ReplayRunClaim): Promise<void>;
}
