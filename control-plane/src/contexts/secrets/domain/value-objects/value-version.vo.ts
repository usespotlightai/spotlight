import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';

export class ValueVersion {
  private readonly kind = 'value-version';

  private constructor(readonly value: number) {}

  static of(raw: number): ValueVersion {
    if (!Number.isInteger(raw) || raw < 0) {
      throw new InvalidSecretError(
        'valueWoVersion',
        'is a whole number that changes to rotate the value',
      );
    }

    return new ValueVersion(raw);
  }

  static same(one: ValueVersion | null, other: ValueVersion | null): boolean {
    return one === null || other === null ? one === other : one.equals(other);
  }

  equals(other: ValueVersion): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
