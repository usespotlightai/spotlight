import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';

export class RepositoryStack {
  private constructor(
    readonly repository: RepositoryName | null,
    readonly startedAt: Date,
  ) {}

  static of(stack: {
    readonly repository: RepositoryName | null;
    readonly startedAt: Date;
  }): RepositoryStack {
    if (Number.isNaN(stack.startedAt.getTime())) {
      throw InvalidChangeStackError.because(
        'a repository stack must say when it started',
      );
    }

    return new RepositoryStack(stack.repository, new Date(stack.startedAt));
  }

  equals(other: RepositoryStack): boolean {
    return (
      RepositoryName.same(this.repository, other.repository) &&
      this.startedAt.getTime() === other.startedAt.getTime()
    );
  }
}
