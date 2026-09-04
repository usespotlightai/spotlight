import { InvalidAssemblyLineNameError } from '@domain/exceptions/invalid-assembly-line-name.error';

const MAX_LENGTH = 100;

export class AssemblyLineName {
  private readonly kind = 'assembly-line-name' as const;

  private constructor(readonly value: string) {}

  static of(raw: string): AssemblyLineName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidAssemblyLineNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidAssemblyLineNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new AssemblyLineName(trimmed);
  }

  equals(other: AssemblyLineName): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
