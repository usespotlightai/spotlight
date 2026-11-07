import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class HookOccurrenceKey {
  private readonly kind = 'hook-occurrence-key';

  private constructor(readonly value: string) {}

  static of(raw: string): HookOccurrenceKey {
    if (raw.trim().length === 0) {
      throw new InvalidIdentifierError(
        'hook occurrence',
        'names the one time an event happened, and is never empty',
      );
    }

    return new HookOccurrenceKey(raw);
  }

  equals(other: HookOccurrenceKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
