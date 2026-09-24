import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';

export class RunnerTerms {
  private readonly kind = 'runner-terms' as const;

  private constructor(readonly values: readonly string[]) {}

  static none(): RunnerTerms {
    return new RunnerTerms([]);
  }

  static of(raw: readonly string[]): RunnerTerms {
    const values: string[] = [];

    for (const each of raw) {
      const term = each.trim();

      if (!term) {
        throw new InvalidRunnerPlacementError('answer to no empty term');
      }

      if (!values.includes(term)) {
        values.push(term);
      }
    }

    return new RunnerTerms(values);
  }

  has(term: string): boolean {
    return this.values.includes(term);
  }

  equals(other: RunnerTerms): boolean {
    return (
      this.kind === other.kind &&
      this.values.length === other.values.length &&
      this.values.every((each) => other.has(each))
    );
  }
}
