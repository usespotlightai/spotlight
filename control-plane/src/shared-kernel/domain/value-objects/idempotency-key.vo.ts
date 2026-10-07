import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

const SHAPE = /^[\x21-\x7e]{1,255}$/;

export class IdempotencyKey {
  private readonly kind = 'idempotency-key';

  private constructor(readonly value: string) {}

  static of(raw: string): IdempotencyKey {
    if (!SHAPE.test(raw)) {
      throw new InvalidIdentifierError(
        'idempotency key',
        'must be 1 to 255 visible characters',
      );
    }

    return new IdempotencyKey(raw);
  }

  equals(other: IdempotencyKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
