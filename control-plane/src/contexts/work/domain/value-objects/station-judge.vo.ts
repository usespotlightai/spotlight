import { InvalidRubricScaleError } from '@shared-kernel/domain/exceptions/invalid-rubric-scale.error';
import { RubricScale } from '@shared-kernel/domain/value-objects/rubric-scale.vo';
import { InvalidStationJudgeError } from '@work/domain/exceptions/invalid-station-judge.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MAX_RUBRIC_LENGTH = 20_000;

const MAX_CLAIMS = 20;

const MAX_CLAIM_LENGTH = 500;

const ALL_CLAIMS = 1;

class InvalidRubricError extends InvalidStationJudgeError {
  constructor(reason: string) {
    super('rubric', reason);
  }
}

class InvalidClaimError extends InvalidStationJudgeError {
  constructor(reason: string) {
    super('claims', `each ${reason}`);
  }
}

const isRate = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const rubricOf = (written: string, scored: boolean): string => {
  const rubric = WrittenText.of(written, MAX_RUBRIC_LENGTH, InvalidRubricError);

  if (!scored) {
    return rubric;
  }

  try {
    RubricScale.of(rubric);
  } catch (error) {
    if (error instanceof InvalidRubricScaleError) {
      throw new InvalidRubricError(
        'names its scale as "scores: yes-no" or "scores: 1-5" on its first line',
      );
    }
    throw error;
  }

  return rubric;
};

const claimsOf = (written: readonly string[]): readonly string[] => {
  if (written.length === 0 || written.length > MAX_CLAIMS) {
    throw new InvalidStationJudgeError(
      'claims',
      `must list 1 to ${MAX_CLAIMS} claims`,
    );
  }

  return written.map((each) =>
    WrittenText.of(each, MAX_CLAIM_LENGTH, InvalidClaimError).trim(),
  );
};

export class StationJudge {
  private constructor(
    readonly rubric: string | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly sample: number,
    readonly minAgreement: number,
  ) {}

  static of(input: {
    rubric?: string | null;
    claims?: readonly string[] | null;
    passThreshold?: number | null;
    sample: number;
    minAgreement: number;
  }): StationJudge {
    const written = input.rubric ?? null;
    const listed = input.claims ?? null;
    const passThreshold = input.passThreshold ?? ALL_CLAIMS;

    if (written === null && listed === null) {
      throw new InvalidStationJudgeError('rubric', 'or claims must be set');
    }

    const rubric = written === null ? null : rubricOf(written, listed === null);
    const claims = listed === null ? [] : claimsOf(listed);

    if (
      listed === null &&
      input.passThreshold !== undefined &&
      input.passThreshold !== null
    ) {
      throw new InvalidStationJudgeError(
        'passThreshold',
        'needs claims to count',
      );
    }

    if (!isRate(passThreshold)) {
      throw new InvalidStationJudgeError(
        'passThreshold',
        'must be from 0 to 1',
      );
    }
    if (!isRate(input.sample)) {
      throw new InvalidStationJudgeError('sample', 'must be from 0 to 1');
    }
    if (!isRate(input.minAgreement)) {
      throw new InvalidStationJudgeError('minAgreement', 'must be from 0 to 1');
    }

    return new StationJudge(
      rubric,
      claims,
      passThreshold,
      input.sample,
      input.minAgreement,
    );
  }

  get criteria(): string {
    return JSON.stringify({
      rubric: this.rubric,
      claims: this.claims,
      passThreshold: this.passThreshold,
    });
  }

  equals(other: StationJudge): boolean {
    return (
      this.criteria === other.criteria &&
      this.sample === other.sample &&
      this.minAgreement === other.minAgreement
    );
  }
}
