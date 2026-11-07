import { InvalidWorkingCopyArchiveError } from '@runs/domain/exceptions/invalid-working-copy-archive.error';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export class WorkingCopyArchiveId {
  private constructor(readonly value: string) {}

  static of(raw: string): WorkingCopyArchiveId {
    const value = raw.trim();

    if (!ID.test(value)) {
      throw new InvalidWorkingCopyArchiveError('id must not be empty');
    }

    return new WorkingCopyArchiveId(value);
  }

  equals(other: WorkingCopyArchiveId): boolean {
    return this.value === other.value;
  }
}
