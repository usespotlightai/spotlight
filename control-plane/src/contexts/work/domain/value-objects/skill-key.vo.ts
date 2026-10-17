import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  CATALOG_SOURCE,
  catalogReferenceParts,
  isCatalogReference,
  isSlug,
  MAX_SLUG_LENGTH,
  unversioned,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class SkillKey {
  private constructor(readonly value: string) {}

  static of(raw: string): SkillKey {
    const trimmed = raw.trim();

    if (!isSlug(trimmed) && !isCatalogReference(trimmed)) {
      throw new InvalidIdentifierError(
        'skill',
        `must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters (e.g. spotlight-handover), or a catalog skill id (e.g. catalog.research@1.0.0)`,
      );
    }

    return new SkillKey(trimmed);
  }

  get isSpotlights(): boolean {
    return this.value.startsWith('spotlight-');
  }

  get catalogued(): boolean {
    return isCatalogReference(this.value);
  }

  get unversioned(): string {
    return unversioned(this.value);
  }

  get folder(): string {
    return this.catalogued
      ? `spotlight-${CATALOG_SOURCE}-${catalogReferenceParts(this.value).name}`
      : this.value;
  }

  equals(other: SkillKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
