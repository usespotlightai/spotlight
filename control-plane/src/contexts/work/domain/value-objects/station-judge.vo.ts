import { InvalidStationJudgeError } from '@work/domain/exceptions/invalid-station-judge.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MOST_RUBRIC_LENGTH = 20_000;

class InvalidRubricError extends InvalidStationJudgeError {
  constructor(reason: string) {
    super('rubric', reason);
  }
}

const isShare = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

export class StationJudge {
  private constructor(
    readonly rubric: string,
    readonly sample: number,
    readonly trust: number,
  ) {}

  static of(input: {
    rubric: string;
    sample: number;
    trust: number;
  }): StationJudge {
    const rubric = WrittenText.prose(
      input.rubric,
      MOST_RUBRIC_LENGTH,
      InvalidRubricError,
    );

    if (!isShare(input.sample)) {
      throw new InvalidStationJudgeError(
        'sample',
        'is the share of runs judged, from 0 to 1',
      );
    }
    if (!isShare(input.trust)) {
      throw new InvalidStationJudgeError(
        'trust',
        'is how often the judge must agree with people, from 0 to 1',
      );
    }

    return new StationJudge(rubric, input.sample, input.trust);
  }

  equals(other: StationJudge): boolean {
    return (
      this.rubric === other.rubric &&
      this.sample === other.sample &&
      this.trust === other.trust
    );
  }
}
