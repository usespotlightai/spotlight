import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class ArchiveDigest {
  private constructor(readonly sha256: string) {}

  static of(sha256: string): ArchiveDigest {
    const value = sha256.trim().toLowerCase();

    if (!SHA256_HEX.test(value)) {
      throw new InvalidWorkspaceArchiveError(
        'digest must be a SHA-256 of 64 hexadecimal digits',
      );
    }

    return new ArchiveDigest(value);
  }

  equals(other: ArchiveDigest): boolean {
    return this.sha256 === other.sha256;
  }
}
