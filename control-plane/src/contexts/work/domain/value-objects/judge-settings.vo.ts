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
