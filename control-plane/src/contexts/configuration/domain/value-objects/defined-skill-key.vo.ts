import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';

export class DefinedSkillKey {
  private constructor(readonly skill: SkillKey) {}

  static of(raw: string): DefinedSkillKey {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw new InvalidIdentifierError(
        'skill',
        `must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in spotlight-handover`,
      );
    }

    return new DefinedSkillKey(SkillKey.of(trimmed));
  }

  get value(): string {
    return this.skill.value;
  }

  get isReserved(): boolean {
    return this.skill.isReserved;
  }

  equals(other: DefinedSkillKey): boolean {
    return this.skill.equals(other.skill);
  }

  toString(): string {
    return this.value;
  }
}
