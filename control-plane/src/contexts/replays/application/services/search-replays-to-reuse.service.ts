import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { reusedOf } from '@replays/domain/services/reused-replays';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReusedReplays } from '@replays/domain/value-objects/reused-replays.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';

interface Wanted {
  readonly set: ReplaySet;
  readonly candidate: StationHashes;
  readonly live: StationHashes;
  readonly repeats: number;
}

export class SearchReplaysToReuse {
  constructor(
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
  ) {}

  async for(wanted: Wanted): Promise<ReusedReplays | null> {
    const replays = await this.replays.ofSet(wanted.set.id);
    const configs = await this.candidates.findMany(
      [...new Set(replays.map((each) => each.candidateId.value))].map((each) =>
        CandidateId.of(each),
      ),
    );

    return reusedOf({
      runs: wanted.set.runs,
      repeats: wanted.repeats,
      candidate: wanted.candidate,
      live: wanted.live,
      replays,
      configs: new Map(configs.map((each) => [each.id.value, each.hashes])),
    });
  }
}
