import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
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
    readonly calibration: boolean,
  ) {}

  static of(input: {
    setId: ReplaySetId;
    candidateId: CandidateId;
    baseline: boolean;
    ceiling: Money;
    repeats: number;
    calibration: boolean;
  }): ReplayStartDetail {
    return new ReplayStartDetail(
      input.setId.value,
      input.candidateId.value,
      input.baseline,
      `${input.ceiling.amount} ${input.ceiling.currency}`,
      input.repeats,
      input.calibration,
    );
  }

  recorded(): RecordedDetail {
    return {
      set: this.setId,
      candidate: this.candidateId,
      baseline: this.baseline,
      ceiling: this.ceiling,
      repeats: this.repeats,
      calibration: this.calibration,
    };
  }
}
