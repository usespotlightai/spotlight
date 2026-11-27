import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isCatalogReference,
  isSlug,
  unversioned,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class SkillKey {
  private constructor(readonly value: string) {}

  static of(raw: string): SkillKey {
    const trimmed = raw.trim();

    if (!isSlug(trimmed) && !isCatalogReference(trimmed)) {
      throw InvalidIdentifierError.notSlug(
        'skill key',
        'spotlight-handover',
        'a catalog skill id, such as catalog.research@1.0.0',
      );
    }

    return new SkillKey(trimmed);
  }

  get isReserved(): boolean {
    return this.value.startsWith('spotlight-');
  }

  get catalogued(): boolean {
    return isCatalogReference(this.value);
  }

  get unversioned(): string {
    return unversioned(this.value);
  }

  equals(other: SkillKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
