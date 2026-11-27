import { InvalidRunnerLabelError } from '@runners/domain/exceptions/invalid-runner-label.error';
import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class RunnerLabels {
  private readonly kind = 'runner-labels';

  private constructor(readonly values: readonly string[]) {}

  static none(): RunnerLabels {
    return new RunnerLabels([]);
  }

  static of(raw: readonly string[]): RunnerLabels {
    const values: string[] = [];

    for (const each of raw) {
      const label = each.trim();

      if (!isSlug(label)) {
        throw InvalidRunnerLabelError.notSlug('vpc-internal');
      }

      if (values.includes(label)) {
        throw new InvalidRunnerLabelError(`${label} is named twice`);
      }

      values.push(label);
    }

    return new RunnerLabels(values);
  }

  equals(other: RunnerLabels): boolean {
    return (
      other instanceof RunnerLabels &&
      this.values.length === other.values.length &&
      this.values.every((each) => other.values.includes(each))
    );
  }
}
