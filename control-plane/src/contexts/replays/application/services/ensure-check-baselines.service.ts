import type { WorkPort } from '@replays/application/ports/work.port';
import type { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import type { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { needsBaseline } from '@replays/domain/services/baseline';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class EnsureCheckBaselines implements PendingJobsPort {
  readonly name = 'EnsureCheckBaselines';

  constructor(
    private readonly checks: ReplayCheckRepository,
    private readonly evaluations: CheckEvaluations,
    private readonly sets: ReplaySetRepository,
    private readonly replays: ReplayRepository,
    private readonly work: WorkPort,
    private readonly snapshots: LiveSnapshots,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    for (const check of await this.checks.awaitingBaseline()) {
      try {
        await this.ensure(check);
      } catch (error) {
        this.logger.warn(
          { checkId: check.id.value, error },
          'A replay check’s baseline could not be ensured; Spotlight retries it later',
        );
      }
    }
  }

  private async ensure(check: ReplayCheck): Promise<void> {
    const { baseline, set, replay } = await this.evaluations.of(check);

    if (baseline) {
      await this.checks.save(check.recordBaseline());
      return;
    }

    const live =
      set && !set.isAtGoneStation && replay
        ? await this.work.live(set.station.lineId, set.station.stationId)
        : null;

    if (!live || live.hashes.scoring !== check.liveHashes.scoring) {
      await this.checks.save(check.markBaselineUnavailable());
      return;
    }

    await this.transaction.inTransaction(async () => {
      const locked = await this.sets.locked(check.setId);

      if (
        !locked ||
        !needsBaseline(
          locked,
          await this.replays.ofSet(locked.id),
          check.liveHashes.scoring,
          check.repeats,
        )
      ) {
        return;
      }

      await this.replays.add(
        Replay.start({
          id: ReplayId.of(this.ids.generate()),
          set: locked,
          candidate: await this.snapshots.taken(locked),
          baseline: true,
          ceiling: check.threshold.ceiling,
          unpricedRate: check.threshold.unpricedRunIn(
            locked.entries.length * check.repeats,
          ),
          repeats: check.repeats,
          at: this.clock.now(),
          by: ChangeActor.spotlight(locked.workspaceId),
        }),
      );
    });
  }
}
