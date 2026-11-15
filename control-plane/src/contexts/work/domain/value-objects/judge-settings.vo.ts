import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { isPassThreshold } from '@shared-kernel/domain/value-objects/claim-share';

const isRate = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

export class JudgeSettings {
  private constructor(
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly rubricVersion: string,
    readonly sample: number,
    readonly minAgreement: number,
  ) {}

  static of(input: {
    claims: readonly string[];
    passThreshold: number;
    rubricVersion: string;
    sample: number;
    minAgreement: number;
  }): JudgeSettings {
    if (input.claims.length === 0) {
      throw new InconsistentStateError('judge', 'has no claims');
    }

    if (
      !isPassThreshold(input.passThreshold) ||
      !isRate(input.sample) ||
      !isRate(input.minAgreement)
    ) {
      throw new InconsistentStateError(
        'judge',
        'has a pass threshold that is not above 0 and up to 1, or a sample or agreement outside 0 to 1',
      );
    }

    return new JudgeSettings(
      [...input.claims],
      input.passThreshold,
      input.rubricVersion,
      input.sample,
      input.minAgreement,
    );
  }

  equals(other: JudgeSettings): boolean {
    return (
      this.rubricVersion === other.rubricVersion &&
      this.sample === other.sample &&
      this.minAgreement === other.minAgreement
    );
  }
}
