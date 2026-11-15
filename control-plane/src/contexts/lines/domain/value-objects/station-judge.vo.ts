import { InvalidStationJudgeError } from '@lines/domain/exceptions/invalid-station-judge.error';
import { WrittenText } from '@lines/domain/value-objects/written-text';
import {
  ALL_CLAIMS,
  isPassThreshold,
  isShare,
} from '@shared-kernel/domain/value-objects/claim-share';
import {
  MAX_CLAIM_LENGTH,
  MAX_CLAIMS,
} from '@shared-kernel/domain/value-objects/judge-criteria.vo';

export { ALL_CLAIMS };

class InvalidClaimError extends InvalidStationJudgeError {
  constructor(reason: string) {
    super('claims', `each ${reason}`);
  }
}

const claimsOf = (written: readonly string[]): readonly string[] => {
  if (
    !Array.isArray(written) ||
    written.length === 0 ||
    written.length > MAX_CLAIMS
  ) {
    throw new InvalidStationJudgeError(
      'claims',
      `must list 1 to ${MAX_CLAIMS} claims`,
    );
  }

  return written.map((each: string) =>
    WrittenText.of(each, MAX_CLAIM_LENGTH, InvalidClaimError).trim(),
  );
};

export class StationJudge {
  private constructor(
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly sample: number,
    readonly minAgreement: number,
  ) {}

  static of(input: {
    claims: readonly string[];
    passThreshold?: number | null;
    sample: number;
    minAgreement: number;
  }): StationJudge {
    const claims = claimsOf(input.claims);
    const passThreshold = input.passThreshold ?? ALL_CLAIMS;

    if (!isPassThreshold(passThreshold)) {
      throw new InvalidStationJudgeError(
        'passThreshold',
        'must be above 0, up to 1',
      );
    }
    if (!isShare(input.sample)) {
      throw new InvalidStationJudgeError('sample', 'must be from 0 to 1');
    }
    if (!isShare(input.minAgreement)) {
      throw new InvalidStationJudgeError('minAgreement', 'must be from 0 to 1');
    }

    return new StationJudge(
      claims,
      passThreshold,
      input.sample,
      input.minAgreement,
    );
  }

  get criteria(): string {
    return JSON.stringify({
      claims: this.claims,
      passThreshold: this.passThreshold,
    });
  }

  rubricVersion(sha256: (text: string) => string): string {
    return sha256(this.criteria);
  }

  sameClaimsAs(other: StationJudge): boolean {
    return this.criteria === other.criteria;
  }

  equals(other: StationJudge): boolean {
    return (
      this.criteria === other.criteria &&
      this.sample === other.sample &&
      this.minAgreement === other.minAgreement
    );
  }
}
