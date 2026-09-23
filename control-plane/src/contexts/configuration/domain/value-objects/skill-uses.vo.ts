import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';

export interface SkillUse {
  readonly skill: string;
  readonly by: string;
}

export class SkillUses {
  private readonly kind = 'skill-uses';

  private constructor(readonly uses: readonly SkillUse[]) {}

  static of(uses: readonly SkillUse[]): SkillUses {
    return new SkillUses(uses.map((each) => ({ ...each })));
  }

  static none(): SkillUses {
    return new SkillUses([]);
  }

  of(key: SkillKey): SkillUses {
    return new SkillUses(this.uses.filter((each) => each.skill === key.value));
  }

  get isEmpty(): boolean {
    return this.uses.length === 0;
  }

  equals(other: SkillUses): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify(this.uses) === JSON.stringify(other.uses)
    );
  }
}
