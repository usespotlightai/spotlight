import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class RotationVersion {
  private readonly kind = 'rotation-version';

  private constructor(readonly value: number | null) {}

  static of(value: number | null): RotationVersion {
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new InconsistentStateError(
        'rotation version',
        `is not a whole number from 0 (${value})`,
      );
    }

    return new RotationVersion(value);
  }

  rotatesOn(next: RotationVersion): boolean {
    return next.value !== this.value;
  }

  equals(other: RotationVersion): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
