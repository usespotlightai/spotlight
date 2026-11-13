import type { LiveCandidates } from '@replays/application/services/live-candidates.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  currentBaselineFor,
  needsBaseline,
} from '@replays/domain/services/baseline';
import type { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

export class StartCheckReplays {
  constructor(
    private readonly checks: ReplayCheckRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly sets: ReplaySetRepository,
    private readonly snapshots: LiveCandidates,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  started(event: ReplayCheckStarted): Promise<void> {
    return this.replayOf(event.checkId, event.change.by);
  }

  async replayOf(checkId: ReplayCheckId, by: ChangeActor): Promise<void> {
    const check = await this.checks.find(checkId);

    if (!check?.replayId || (await this.replays.find(check.replayId))) {
      return;
    }

    const set = await this.sets.find(check.setId);
    const candidate = await this.candidates.find(check.candidateId);

    if (!set || set.isAtGoneStation || !candidate) {
      return;
    }

    const live =
      check.needsOwnBaseline &&
      needsBaseline(
        set,
        await this.replays.ofSet(set.id),
        check.liveHashes.scoring,
        check.baselineRepeats,
      )
        ? await this.snapshots.taken(set)
        : null;
    let wantedLive = false;

    try {
      wantedLive = await this.replayed(check, candidate, live, by);
    } finally {
      if (live && !wantedLive) {
        await this.snapshots.release(live);
      }
    }
  }

  private replayed(
    check: ReplayCheck,
    candidate: Candidate,
    live: Candidate | null,
    by: ChangeActor,
  ): Promise<boolean> {
    return this.transaction.inTransaction(async () => {
      const set = await this.sets.locked(check.setId);

      const replayId = check.replayId;

      if (
        !set ||
        !replayId ||
        set.isAtGoneStation ||
        (await this.replays.find(replayId))
      ) {
        return false;
      }

      const runSubset = check.runSubsetIn(set.runs);
      const runs = runSubset ?? set.runs;

      if (runs.length === 0) {
        return false;
      }

      const ofSet = await this.replays.ofSet(set.id);
      const { scoring } = check.liveHashes;
      const wanting =
        live && needsBaseline(set, ofSet, scoring, check.baselineRepeats)
          ? {
              id: ReplayId.of(this.ids.generate()),
              candidate: live.asReplayed,
              ceiling: check.baselineCeiling,
              repeats: check.baselineRepeats,
            }
          : null;

      await this.replays.add(
        Replay.start({
          id: replayId,
          set: set.snapshot,
          candidate: candidate.asReplayed,
          baseline: false,
          ceiling: check.threshold.ceiling,
          unpricedRate: check.threshold.unpricedRunIn(
            runs.length * check.repeats,
          ),
          repeats: check.repeats,
          ...(runSubset ? { runSubset } : {}),
          pairwiseReferenceId: check.pairwiseReferenceFor(
            wanting
              ? wanting.id
              : (currentBaselineFor(set, ofSet, scoring, check.baselineRepeats)
                  ?.id ?? null),
          ),
          at: this.clock.now(),
          by,
          wanting,
        }),
      );

      return wanting !== null;
    });
  }
}
