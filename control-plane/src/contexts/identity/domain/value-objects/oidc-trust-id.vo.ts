import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class OidcTrustId {
  private readonly kind = 'oidc-trust';

  private constructor(readonly value: string) {}

  static of(value: string): OidcTrustId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('OIDC trust');
    }
    return new OidcTrustId(value);
  }

  equals(other: OidcTrustId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
