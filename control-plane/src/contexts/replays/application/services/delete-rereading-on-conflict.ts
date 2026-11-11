import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const ATTEMPTS = 5;

type Deletable<J> = { delete(): J };

export const deleteRereadingOnConflict = async <J extends Deletable<J>>(
  transaction: TransactionPort,
  judging: {
    readonly current: () => Promise<J | null>;
    readonly save: (deleted: J) => Promise<void>;
    readonly isConflict: (error: unknown) => boolean;
  },
  attempts = ATTEMPTS,
): Promise<void> => {
  try {
    await transaction.inTransaction(async () => {
      const current = await judging.current();

      if (current) {
        await judging.save(current.delete());
      }
    });
  } catch (error) {
    if (attempts > 1 && judging.isConflict(error)) {
      return deleteRereadingOnConflict(transaction, judging, attempts - 1);
    }

    throw error;
  }
};
