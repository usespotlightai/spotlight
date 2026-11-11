import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const SPOTLIGHT = 'spotlight';

export class PrincipalRef {
  private readonly kind = 'principal-ref';

  private constructor(readonly value: string) {}

  static of(principal: Principal): PrincipalRef {
    return new PrincipalRef(principal.toString());
  }

  static spotlight(): PrincipalRef {
    return new PrincipalRef(SPOTLIGHT);
  }

  static rehydrate(raw: string): PrincipalRef {
    if (!raw.trim()) {
      throw new InconsistentStateError(
        'Terraform state',
        'names no principal that locked or wrote it',
      );
    }

    return new PrincipalRef(raw);
  }

  equals(other: PrincipalRef): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
