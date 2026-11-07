import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class EgressId {
  private readonly kind = 'egress-id';

  private constructor(readonly value: string) {}

  static of(raw: string): EgressId {
    if (raw.trim().length === 0) {
      throw new InconsistentStateError(
        'secret fetcher',
        'was named with no egress',
      );
    }

    return new EgressId(raw);
  }

  equals(other: EgressId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
