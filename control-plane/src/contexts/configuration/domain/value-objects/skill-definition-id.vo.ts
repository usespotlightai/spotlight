import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class SkillDefinitionId {
  private readonly kind = 'skill-definition';

  private constructor(readonly value: string) {}

  static of(value: string): SkillDefinitionId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('skill');
    }

    return new SkillDefinitionId(value);
  }

  equals(other: SkillDefinitionId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
