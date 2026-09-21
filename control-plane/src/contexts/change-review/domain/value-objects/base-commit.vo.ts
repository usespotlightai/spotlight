import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';

const SHA = /^[0-9a-f]{40}$/;

export class BaseCommit {
  private constructor(readonly value: string) {}

  static of(raw: string): BaseCommit {
    const trimmed = raw.trim().toLowerCase();

    if (!SHA.test(trimmed)) {
      throw InvalidChangeStackError.because(
        'begins at a commit named by its full forty character hash',
      );
    }

    return new BaseCommit(trimmed);
  }

  equals(other: BaseCommit): boolean {
    return this.value === other.value;
  }
}
