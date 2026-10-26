import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class StateName {
  private constructor(readonly value: string) {}

  static of(raw: string): StateName {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw new InvalidTerraformStateError(
        `name must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in default`,
      );
    }

    return new StateName(trimmed);
  }

  equals(other: StateName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
