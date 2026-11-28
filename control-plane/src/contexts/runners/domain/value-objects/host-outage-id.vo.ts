import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class HostOutageId {
  private readonly kind = 'host-outage';

  private constructor(readonly value: string) {}

  static of(value: string): HostOutageId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('host outage');
    }

    return new HostOutageId(value);
  }

  equals(other: HostOutageId): boolean {
    return other instanceof HostOutageId && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
