import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class TaskId {
  private readonly kind = 'task';

  private constructor(readonly value: string) {}

  static of(value: string): TaskId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('task');
    }
    return new TaskId(value);
  }

  equals(other: TaskId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
