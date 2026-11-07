import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const isRate = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

export class JudgeSettings {
  private constructor(
    readonly rubric: string | null,
    readonly claims: readonly string[],
    readonly passThreshold: number,
    readonly sample: number,
    readonly minAgreement: number,
  ) {}

  static of(input: {
    rubric: string | null;
    claims: readonly string[];
    passThreshold: number;
    sample: number;
    minAgreement: number;
  }): JudgeSettings {
    if (input.rubric === null && input.claims.length === 0) {
      throw new InconsistentStateError(
        'judge',
        'has neither a rubric nor claims',
      );
    }

    if (
      !isRate(input.passThreshold) ||
      !isRate(input.sample) ||
      !isRate(input.minAgreement)
    ) {
      throw new InconsistentStateError(
        'judge',
        'has a pass threshold, sample or agreement outside 0 to 1',
      );
    }

    return new JudgeSettings(
      input.rubric,
      [...input.claims],
      input.passThreshold,
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

  equals(other: JudgeSettings): boolean {
    return (
      this.criteria === other.criteria &&
      this.sample === other.sample &&
      this.minAgreement === other.minAgreement
    );
  }
}
