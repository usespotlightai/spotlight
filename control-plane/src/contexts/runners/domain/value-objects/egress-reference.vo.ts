import { EgressId } from '@runners/domain/value-objects/egress-id.vo';

const PLATFORM = 'spotlight';

export class EgressReference {
  private readonly kind = 'egress-reference';

  private constructor(readonly egressId: EgressId | null) {}

  static platform(): EgressReference {
    return new EgressReference(null);
  }

  static to(egressId: EgressId): EgressReference {
    return new EgressReference(egressId);
  }

  static of(raw: string): EgressReference {
    const named = raw.trim();

    return named === PLATFORM
      ? EgressReference.platform()
      : EgressReference.to(EgressId.of(named));
  }

  get isPlatform(): boolean {
    return this.egressId === null;
  }

  get value(): string {
    return this.egressId?.value ?? PLATFORM;
  }

  equals(other: EgressReference): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
