import type { CheckEvaluations } from '@replays/application/services/check-evaluations.service';
import type { LiveCandidates } from '@replays/application/services/live-candidates.service';
import type { StationConfigs } from '@replays/application/services/station-configs.service';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
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
    private readonly configs: StationConfigs,
    private readonly snapshots: LiveCandidates,
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
    const { baseline, set, replay, reusedEvidence } =
      await this.evaluations.of(check);

    if (reusedEvidence) {
      const settled = check.settleReusedBaseline(reusedEvidence);

      if (settled !== check) {
        await this.checks.save(settled);
      }
      return;
    }
    if (baseline) {
      await this.checks.save(check.recordBaseline());
      return;
    }

    if (!replay) {
      return;
    }

    if (!check.wantsBaselineFor(replay)) {
      await this.checks.save(check.markBaselineUnavailable());
      return;
    }

    const live =
      set && !set.isAtGoneStation
        ? await this.configs.live(set.station.lineId, set.station.stationId)
        : null;

    if (!check.measuresAgainst(live?.hashes ?? null)) {
      await this.checks.save(check.markBaselineUnavailable());
      return;
    }

    const seen = await this.sets.find(check.setId);

    if (
      !seen ||
      !needsBaseline(
        seen,
        await this.replays.ofSet(seen.id),
        check.liveHashes.scoring,
        check.baselineRepeats,
      )
    ) {
      return;
    }

    const snapshot = await this.snapshots.taken(seen);
    let started = false;

    try {
      started = await this.transaction.inTransaction(async () => {
        const locked = await this.sets.locked(check.setId);

        if (
          !locked ||
          !needsBaseline(
            locked,
            await this.replays.ofSet(locked.id),
            check.liveHashes.scoring,
            check.baselineRepeats,
          )
        ) {
          return false;
        }

        await this.replays.add(
          Replay.start({
            id: ReplayId.of(this.ids.generate()),
            set: locked.snapshot,
            candidate: snapshot.asReplayed,
            baseline: true,
            ceiling: check.baselineCeiling,
            unpricedRate: check.threshold.unpricedRunIn(
              locked.entries.length * check.repeats,
            ),
            repeats: check.baselineRepeats,
            at: this.clock.now(),
            by: ChangeActor.spotlight(locked.workspaceId),
          }),
        );

        return true;
      });
    } finally {
      if (!started) {
        await this.snapshots.release(snapshot);
      }
    }
  }
}
