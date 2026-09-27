import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class TaskAsideId {
  private readonly kind = 'task-aside';

  private constructor(readonly value: string) {}

  static of(value: string): TaskAsideId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('task aside');
    }
    return new TaskAsideId(value);
  }

  equals(other: TaskAsideId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
