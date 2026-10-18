import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';

export class RunnerOffer {
  private readonly kind = 'runner-offer' as const;

  private constructor(
    readonly values: readonly string[],
    readonly running: RunningImage | null,
  ) {}

  static none(): RunnerOffer {
    return new RunnerOffer([], null);
  }

  static of(raw: readonly string[]): RunnerOffer {
    const values: string[] = [];

    for (const each of raw) {
      const label = each.trim();

      if (!label) {
        throw new InvalidRunnerPlacementError('cannot have an empty label');
      }

      if (!values.includes(label)) {
        values.push(label);
      }
    }

    return new RunnerOffer(values, null);
  }

  runningIn(running: RunningImage | null): RunnerOffer {
    return new RunnerOffer(this.values, running);
  }

  has(label: string): boolean {
    return this.values.includes(label);
  }

  supports(image: RunnerImage | null): boolean {
    return this.running?.supports(image) ?? true;
  }

  equals(other: RunnerOffer): boolean {
    return (
      this.kind === other.kind &&
      this.values.length === other.values.length &&
      this.values.every((each) => other.has(each)) &&
      sameOrBothNone(this.running, other.running)
    );
  }
}
