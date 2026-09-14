import { InvalidRunPriorityError } from '@domain/exceptions/invalid-run-priority.error';

export class RunPriority {
  private constructor(readonly value: number) {}

  static readonly normal = new RunPriority(0);

  static of(value: number): RunPriority {
    if (!Number.isInteger(value)) {
      throw new InvalidRunPriorityError(
        `must be a whole number, but was ${value}`,
      );
    }

    return new RunPriority(value);
  }

  isHigherThan(other: RunPriority): boolean {
    return this.value > other.value;
  }

  equals(other: RunPriority): boolean {
    return this.value === other.value;
  }
}
