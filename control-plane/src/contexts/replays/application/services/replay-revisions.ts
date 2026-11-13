import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayVersionConflictError } from '@replays/domain/exceptions/replay-version-conflict.error';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export const REPLAY_REVISION_ATTEMPTS = 5;

export const REPLAY_REVISION_PAUSE_MS = 25;

const pauseBefore = (attempt: number): number =>
  Math.floor(Math.random() * (attempt - 1) * REPLAY_REVISION_PAUSE_MS);

export const readOnce = <T>(read: () => Promise<T>): (() => Promise<T>) => {
  let reading: Promise<T> | undefined;

  return () => (reading ??= read());
};

export const reviseReplay = async (
  replays: ReplayRepository,
  transaction: TransactionPort,
  clock: ClockPort,
  load: () => Promise<Replay | null>,
  change: (replay: Replay) => Replay | Promise<Replay>,
): Promise<Replay | null> => {
  for (let attempt = 1; ; attempt++) {
    if (attempt > 1) {
      await clock.sleep(pauseBefore(attempt));
    }

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
