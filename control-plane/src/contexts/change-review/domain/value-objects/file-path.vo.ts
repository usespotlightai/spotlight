import { InvalidFilePathError } from '@change-review/domain/exceptions/invalid-file-path.error';

export class FilePath {
  private readonly kind = 'file-path';

  private constructor(readonly value: string) {}

  static of(raw: string): FilePath {
    const value = raw.trim().replace(/^\/+/, '');

    if (!value) {
      throw new InvalidFilePathError('names a file');
    }

    return new FilePath(value);
  }

  equals(other: FilePath): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
