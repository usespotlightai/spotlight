import type {
  ReplayCheck,
  ReusedEvidence,
} from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { baselineFor } from '@replays/domain/services/baseline';
import {
  checkedOutcomeOf,
  type ReusedOutcome,
} from '@replays/domain/services/checked-outcome';
import {
  type CheckEvaluation,
  evaluationOf,
} from '@replays/domain/services/replay-check-result';
import type { ReplayOutcome } from '@replays/domain/value-objects/replay-outcome.vo';

export interface EvaluatedCheck {
  readonly evaluation: CheckEvaluation;
  readonly replay: Replay | null;
  readonly outcome: ReplayOutcome | null;
  readonly baseline: Replay | null;
  readonly set: ReplaySet | null;
  readonly reusedEvidence: ReusedEvidence | null;
}

export class CheckEvaluations {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly sets: ReplaySetRepository,
  ) {}

  async of(check: ReplayCheck): Promise<EvaluatedCheck> {
    const replay = check.replayId
      ? await this.replays.find(check.replayId)
      : null;
    const reused = await this.reusedOf(check);
    const set = await this.sets.find(check.setId);
    const seed = check.seed ? await this.replays.find(check.seed) : null;
    const outcome = this.outcomeOf(check, replay, reused);
    const baseline = outcome
      ? (seed ?? (await this.ownBaselineOf(check, outcome)))
      : null;
    const awaiting =
      check.awaitsBaseline && set !== null && !set.isAtGoneStation;

    return {
      evaluation: evaluationOf(
        check,
        outcome,
        baseline?.outcome() ?? null,
        awaiting,
      ),
      replay,
      outcome,
      baseline,
      set,
      reusedEvidence: check.reused
        ? {
            seed: seed !== null,
            reused: reused !== 'gone',
            own: check.replayId === null || replay !== null,
          }
        : null,
    };
  }

  private outcomeOf(
    check: ReplayCheck,
    replay: Replay | null,
    reused: readonly ReusedOutcome[] | 'gone' | null,
  ): ReplayOutcome | null {
    if ((check.replayId && !replay) || reused === 'gone') {
      return null;
    }
    if (reused === null) {
      return replay?.outcome() ?? null;
    }

    return checkedOutcomeOf(replay?.outcome() ?? null, reused);
  }

  private async reusedOf(
    check: ReplayCheck,
  ): Promise<readonly ReusedOutcome[] | 'gone' | null> {
    if (!check.reused) {
      return null;
    }

    const parts: ReusedOutcome[] = [];

    for (const part of check.reused.parts) {
      const replay = await this.replays.find(part.replayId);

      if (!replay) {
        return 'gone';
      }

      parts.push({ outcome: replay.outcome(), runs: part.runs });
    }

    return parts;
  }

  private async ownBaselineOf(
    check: ReplayCheck,
    outcome: ReplayOutcome,
  ): Promise<Replay | null> {
    if (!check.needsOwnBaseline) {
      return null;
    }

    return baselineFor(
      await this.replays.ofSet(check.setId),
      check.liveHashes.scoring,
      outcome.originals,
      check.baselineRepeats,
    );
  }
}
