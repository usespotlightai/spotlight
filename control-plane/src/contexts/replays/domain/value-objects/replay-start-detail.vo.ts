import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
import type {
  ChangeDetail,
  RecordedDetail,
} from '@shared-kernel/domain/value-objects/configuration-change.vo';

export class ReplayStartDetail implements ChangeDetail {
  private constructor(
    readonly setId: string,
    readonly candidateId: string,
    readonly baseline: boolean,
    readonly ceiling: string,
    readonly repeats: number,
  ) {}

  static of(input: {
    setId: ReplaySetId;
    candidateId: CandidateId;
    baseline: boolean;
    ceiling: Spend;
    repeats: number;
  }): ReplayStartDetail {
    return new ReplayStartDetail(
      input.setId.value,
      input.candidateId.value,
      input.baseline,
      `${input.ceiling.amount} ${input.ceiling.currency}`,
      input.repeats,
    );
  }

  recorded(): RecordedDetail {
    return {
      set: this.setId,
      candidate: this.candidateId,
      baseline: this.baseline,
      ceiling: this.ceiling,
      repeats: this.repeats,
    };
  }
}
