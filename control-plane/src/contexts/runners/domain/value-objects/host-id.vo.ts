import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

export class HostId {
  private readonly kind = 'host';

  private constructor(readonly value: string) {}

  static of(value: string): HostId {
    if (!SHAPE.test(value)) {
      throw new InvalidIdentifierError('host');
    }

    return new HostId(value);
  }

  equals(other: HostId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
