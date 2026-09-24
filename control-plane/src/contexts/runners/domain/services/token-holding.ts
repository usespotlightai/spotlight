import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerTokenSpentError } from '@runners/domain/exceptions/runner-token-spent.error';
import { RunnerTokenTakenError } from '@runners/domain/exceptions/runner-token-taken.error';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const refuseTokenHeldElsewhere = (
  holder: Runner | null,
  claimant: RunnerId,
): void => {
  if (!holder || holder.id.equals(claimant)) {
    return;
  }

  throw holder.revoked
    ? new RunnerTokenSpentError()
    : new RunnerTokenTakenError();
};
