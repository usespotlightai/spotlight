import type { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import { ReplayRunDecisionVersionConflictError } from '@replays/domain/exceptions/replay-run-decision-version-conflict.error';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';

const REMOVAL_ATTEMPTS = 3;

export const removeReplayRunDecision = async (
  decisions: ReplayRunDecisionRepository,
  loaded: ReplayRunDecision,
): Promise<void> => {
  let decision: ReplayRunDecision | null = loaded;

  for (let attempt = 1; decision; attempt += 1) {
    try {
      await decisions.save(decision.delete());
      return;
    } catch (error) {
      if (
        !(error instanceof ReplayRunDecisionVersionConflictError) ||
        attempt >= REMOVAL_ATTEMPTS
      ) {
        throw error;
      }

      decision = await decisions.find(loaded.runId);
    }
  }
};
