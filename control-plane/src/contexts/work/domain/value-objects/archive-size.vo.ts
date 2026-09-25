import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';

const MOST_BYTES = 2 * 1024 ** 3;

export class ArchiveSize {
  private constructor(readonly bytes: number) {}

  static of(bytes: number): ArchiveSize {
    if (!Number.isSafeInteger(bytes) || bytes < 1) {
      throw new InvalidWorkspaceArchiveError('must have a size in bytes');
    }

    if (bytes > MOST_BYTES) {
      throw new InvalidWorkspaceArchiveError(
        `may be at most ${MOST_BYTES} bytes, and this one is ${bytes}`,
      );
    }

    return new ArchiveSize(bytes);
  }

  equals(other: ArchiveSize): boolean {
    return this.bytes === other.bytes;
  }
}
