import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { baselineFor } from '@replays/domain/services/baseline';
import {
  type CheckEvaluation,
  evaluationOf,
} from '@replays/domain/services/replay-check-result';

export interface EvaluatedCheck {
  readonly evaluation: CheckEvaluation;
  readonly replay: Replay | null;
  readonly baseline: Replay | null;
  readonly set: ReplaySet | null;
}

export class CheckEvaluations {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly sets: ReplaySetRepository,
  ) {}

  async of(check: ReplayCheck): Promise<EvaluatedCheck> {
    const replay = await this.replays.find(check.replayId);
    const ofSet = await this.replays.ofSet(check.setId);
    const set = await this.sets.find(check.setId);
    const baseline = replay
      ? baselineFor(
          ofSet,
          check.liveHashes.scoring,
          replay.originals,
          check.repeats,
        )
      : null;
    const awaiting =
      check.awaitsBaseline && set !== null && !set.isAtGoneStation;

    return {
      evaluation: evaluationOf(check, replay, baseline, awaiting),
      replay,
      baseline,
      set,
    };
  }
}
