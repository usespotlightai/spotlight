import { InvalidRunnerLabelError } from '@runners/domain/exceptions/invalid-runner-label.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class RunnerLabels {
  private readonly kind = 'runner-labels' as const;

  private constructor(readonly values: readonly string[]) {}

  static none(): RunnerLabels {
    return new RunnerLabels([]);
  }

  static of(raw: readonly string[]): RunnerLabels {
    const values: string[] = [];

    for (const each of raw) {
      const label = each.trim();

      if (!areWords(label)) {
        throw new InvalidRunnerLabelError(
          `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in vpc-internal`,
        );
      }

      if (values.includes(label)) {
        throw new InvalidRunnerLabelError(`${label} is given only once`);
      }

      values.push(label);
    }

    return new RunnerLabels(values);
  }

  joinedWith(other: RunnerLabels): RunnerLabels {
    return new RunnerLabels([
      ...this.values,
      ...other.values.filter((each) => !this.values.includes(each)),
    ]);
  }

  equals(other: RunnerLabels): boolean {
    return (
      this.kind === other.kind &&
      this.values.length === other.values.length &&
      this.values.every((each) => other.values.includes(each))
    );
  }
}
