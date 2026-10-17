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

const isShare = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const rubricOf = (written: string, scored: boolean): string => {
  const rubric = WrittenText.prose(
    written,
    MAX_RUBRIC_LENGTH,
    InvalidRubricError,
  );

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
    WrittenText.prose(each, MAX_CLAIM_LENGTH, InvalidClaimError).trim(),
  );
};

export class StationJudge {
  private constructor(
    readonly rubric: string | null,
    readonly claims: readonly string[],
    readonly passShare: number,
    readonly sample: number,
    readonly trust: number,
  ) {}

  static of(input: {
    rubric?: string | null;
    claims?: readonly string[] | null;
    passShare?: number | null;
    sample: number;
    trust: number;
  }): StationJudge {
    const written = input.rubric ?? null;
    const listed = input.claims ?? null;
    const passShare = input.passShare ?? ALL_CLAIMS;

    if (written === null && listed === null) {
      throw new InvalidStationJudgeError('rubric', 'or claims must be set');
    }

    const rubric = written === null ? null : rubricOf(written, listed === null);
    const claims = listed === null ? [] : claimsOf(listed);

    if (
      listed === null &&
      input.passShare !== undefined &&
      input.passShare !== null
    ) {
      throw new InvalidStationJudgeError('passShare', 'needs claims to count');
    }

    if (!isShare(passShare)) {
      throw new InvalidStationJudgeError(
        'passShare',
        'must be a share from 0 to 1',
      );
    }
    if (!isShare(input.sample)) {
      throw new InvalidStationJudgeError(
        'sample',
        'must be a share from 0 to 1',
      );
    }
    if (!isShare(input.trust)) {
      throw new InvalidStationJudgeError(
        'trust',
        'must be a share from 0 to 1',
      );
    }

    return new StationJudge(
      rubric,
      claims,
      passShare,
      input.sample,
      input.trust,
    );
  }

  get criteria(): string {
    return JSON.stringify({
      rubric: this.rubric,
      claims: this.claims,
      passShare: this.passShare,
    });
  }

  equals(other: StationJudge): boolean {
    return (
      this.criteria === other.criteria &&
      this.sample === other.sample &&
      this.trust === other.trust
    );
  }
}
