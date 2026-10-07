import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';

export class RunnerTerms {
  private readonly kind = 'runner-terms' as const;

  private constructor(
    readonly values: readonly string[],
    readonly running: RunningImage | null,
  ) {}

  static none(): RunnerTerms {
    return new RunnerTerms([], null);
  }

  static of(raw: readonly string[]): RunnerTerms {
    const values: string[] = [];

    for (const each of raw) {
      const term = each.trim();

      if (!term) {
        throw new InvalidRunnerPlacementError('cannot have an empty term');
      }

      if (!values.includes(term)) {
        values.push(term);
      }
    }

    return new RunnerTerms(values, null);
  }

  runningIn(running: RunningImage | null): RunnerTerms {
    return new RunnerTerms(this.values, running);
  }

  has(term: string): boolean {
    return this.values.includes(term);
  }

  serves(image: RunnerImage | null): boolean {
    return this.running?.serves(image) ?? true;
  }

  equals(other: RunnerTerms): boolean {
    return (
      this.kind === other.kind &&
      this.values.length === other.values.length &&
      this.values.every((each) => other.has(each)) &&
      sameOrBothNone(this.running, other.running)
    );
  }
}
