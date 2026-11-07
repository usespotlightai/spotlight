import { InvalidRunPriorityError } from '@work/domain/exceptions/invalid-run-priority.error';

export class RunPriority {
  private constructor(readonly value: number) {}

  static readonly normal = new RunPriority(0);

  static readonly chat = new RunPriority(1_000);

  static readonly trial = new RunPriority(-1);

  static forTask(depth: number): RunPriority {
    return RunPriority.of(depth);
  }

  static of(value: number): RunPriority {
    if (!Number.isInteger(value)) {
      throw new InvalidRunPriorityError(`must be a whole number, not ${value}`);
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
