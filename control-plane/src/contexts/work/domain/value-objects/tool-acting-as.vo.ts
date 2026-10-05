import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ToolActingAs {
  private constructor(
    readonly personId: UserId | null,
    readonly handle: string | null,
  ) {}

  static team(handle: string | null): ToolActingAs {
    return new ToolActingAs(null, handle?.trim() || null);
  }

  static person(personId: UserId, handle: string | null): ToolActingAs {
    return new ToolActingAs(personId, handle?.trim() || null);
  }

  get holder(): 'team' | 'person' {
    return this.personId ? 'person' : 'team';
  }

  equals(other: ToolActingAs): boolean {
    return (
      this.handle === other.handle &&
      (this.personId === null
        ? other.personId === null
        : other.personId !== null && this.personId.equals(other.personId))
    );
  }
}
