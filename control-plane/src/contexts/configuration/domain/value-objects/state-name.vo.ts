import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';
import {
  isSlug,
  slugAdvice,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class StateName {
  private constructor(readonly value: string) {}

  static of(raw: string): StateName {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw new InvalidTerraformStateError(
        `name is not valid. ${slugAdvice('core-network')}`,
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
