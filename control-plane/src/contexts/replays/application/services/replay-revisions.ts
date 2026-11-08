import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayVersionConflictError } from '@replays/domain/exceptions/replay-version-conflict.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export const REPLAY_REVISION_ATTEMPTS = 5;

export const reviseReplay = async (
  replays: ReplayRepository,
  transaction: TransactionPort,
  load: () => Promise<Replay | null>,
  change: (replay: Replay) => Replay | Promise<Replay>,
): Promise<Replay | null> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transaction.inTransaction(async () => {
        const found = await load();

        if (!found) {
          return null;
        }

        const changed = await change(found);

        if (changed !== found) {
          await replays.save(changed);
        }

        return changed;
      });
    } catch (error) {
      if (
        !(error instanceof ReplayVersionConflictError) ||
        attempt >= REPLAY_REVISION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
};
