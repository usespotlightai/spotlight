import type { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';

export interface StationUse {
  readonly name: string;
  readonly line: string;
  readonly station: string;
}

export class StationUses {
  private readonly kind = 'station-uses';

  private constructor(readonly uses: readonly StationUse[]) {}

  static of(uses: readonly StationUse[]): StationUses {
    return new StationUses(uses.map((each) => ({ ...each })));
  }

  static none(): StationUses {
    return new StationUses([]);
  }

  of(key: SkillKey | ProfileKey): StationUses {
    return new StationUses(this.uses.filter((each) => each.name === key.value));
  }

  get isEmpty(): boolean {
    return this.uses.length === 0;
  }

  get stations(): string {
    return this.uses.map((each) => `${each.line}/${each.station}`).join(', ');
  }

  equals(other: StationUses): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify(this.uses) === JSON.stringify(other.uses)
    );
  }
}
