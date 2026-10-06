import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export class WorkspaceArchiveId {
  private constructor(readonly value: string) {}

  static of(raw: string): WorkspaceArchiveId {
    const value = raw.trim();

    if (!ID.test(value)) {
      throw new InvalidWorkspaceArchiveError('id must not be empty');
    }

    return new WorkspaceArchiveId(value);
  }

  equals(other: WorkspaceArchiveId): boolean {
    return this.value === other.value;
  }
}
