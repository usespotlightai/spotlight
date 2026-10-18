import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  EntryMeasures,
  type TokenCounts,
} from '@replays/domain/value-objects/entry-measures.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReplayRunUsageReceived {
  readonly runId: string;
  readonly ms: number | null;
  readonly steps: number;
  readonly changedLines: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
  readonly tokens: TokenCounts;
}

export class RecordReplayRunUsage {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  usageRecorded(event: ReplayRunUsageReceived): Promise<void> {
    const run = RunId.of(event.runId);

    return this.transaction.inTransaction(async () => {
      const replay = await this.replays.ranAs(run);

      if (!replay) {
        return;
      }

      const measured = replay.measure(
        run,
        EntryMeasures.of({
          ms: event.ms,
          steps: event.steps,
          changedLines: event.changedLines,
          cost:
            event.cost !== null && event.currency
              ? Money.of(event.cost, event.currency)
              : null,
          tokens: event.tokens,
        }),
        this.clock.now(),
      );

      if (measured !== replay) {
        await this.replays.save(measured);
      }
    });
  }
}
