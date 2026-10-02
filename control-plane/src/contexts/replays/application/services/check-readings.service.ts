import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { baselineFor } from '@replays/domain/services/baseline';
import {
  type CheckReading,
  readingOf,
} from '@replays/domain/services/replay-check-verdict';

export interface CheckRead {
  readonly reading: CheckReading;
  readonly replay: Replay | null;
  readonly baseline: Replay | null;
  readonly set: ReplaySet | null;
}

export class CheckReadings {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly sets: ReplaySetRepository,
  ) {}

  async of(check: ReplayCheck): Promise<CheckRead> {
    const [replay, ofSet, set] = await Promise.all([
      this.replays.find(check.replayId),
      this.replays.ofSet(check.setId),
      this.sets.find(check.setId),
    ]);
    const baseline = replay
      ? baselineFor(ofSet, check.liveDigests.scoring, replay.originals)
      : null;
    const awaiting =
      check.awaitsBaseline && set !== null && !set.isAtGoneStation;

    return {
      reading: readingOf(check, replay, baseline, awaiting),
      replay,
      baseline,
      set,
    };
  }
}
