import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { ReplayEnded } from '@replays/domain/events/replay-ended.event';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { chargeOf } from '@replays/domain/services/replay-charge';
import { improvedOnBestBefore } from '@replays/domain/services/search-improvement';
import {
  reconciled,
  type SeenRun,
} from '@replays/domain/services/search-reconciliation';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface SearchRunEnded {
  readonly runId: string;
  readonly outcome: string;
  readonly asked: boolean;
  readonly started: boolean;
}

const COMPLETED = 'completed';

export class RecordSearchProgress {
  constructor(
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly healths: SetHealths,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  replayEnded(event: ReplayEnded): Promise<void> {
    const { searchId } = event;

    if (!searchId) {
      return Promise.resolve();
    }

    return this.changing(searchId, async (search) => {
      const replays = await this.replays.ofSearch(search.id);
      const replay = replays.find((each) => each.id.equals(event.replayId));
      const { minGain } = await this.healths.standardAt(search.station);

      return search.recordReplayStopReason(
        event.replayId,
        event.state,
        replay
          ? chargeOf(replay)
          : { spent: Money.none(search.budget.ceiling.currency), unpriced: 0 },
        this.clock.now(),
        this.runIds,
        improvedOnBestBefore(search, event.replayId, replays, minGain),
      );
    });
  }

  async runEnded(event: SearchRunEnded): Promise<void> {
    const run = RunId.of(event.runId);
    const search = await this.searches.ranAs(run);

    if (search) {
      await this.changing(search.id, async (fresh) =>
        fresh.recordRunEnd(
          run,
          {
            failed: event.outcome !== COMPLETED || event.asked,
            started: event.started,
          },
          this.clock.now(),
          this.runIds,
        ),
      );
    }
  }

  async usageRecorded(runId: string, spent: ModelSpent): Promise<void> {
    const run = RunId.of(runId);
    const search = await this.searches.ranAs(run);

    if (search) {
      await this.changing(search.id, async (fresh) =>
        fresh.recordAgentSpend(run, spent, this.clock.now(), this.runIds),
      );
    }
  }

  reconcile(seen: Search, runs: readonly SeenRun[]): Promise<void> {
    return this.changing(seen.id, async (fresh) =>
      reconciled(
        fresh,
        await this.replays.ofSearch(fresh.id),
        seen.replayIds,
        runs,
        (await this.healths.standardAt(fresh.station)).minGain,
        this.clock.now(),
        this.runIds,
      ),
    );
  }

  private readonly runIds = (): RunId => RunId.of(this.ids.generate());

  private changing(
    searchId: SearchId,
    change: (search: Search) => Promise<Search>,
  ): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(searchId);

      if (!search) {
        return;
      }

      const changed = await change(search);

      if (changed !== search) {
        await this.searches.save(changed);
      }
    });
  }
}
