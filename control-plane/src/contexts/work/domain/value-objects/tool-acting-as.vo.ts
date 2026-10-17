import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ToolActingAs {
  private constructor(
    readonly personId: UserId | null,
    readonly linkedAccount: string | null,
  ) {}

  static team(linkedAccount: string | null): ToolActingAs {
    return new ToolActingAs(null, linkedAccount?.trim() || null);
  }

  static person(personId: UserId, linkedAccount: string | null): ToolActingAs {
    return new ToolActingAs(personId, linkedAccount?.trim() || null);
  }

  get actsAs(): 'team' | 'requester' {
    return this.personId ? 'requester' : 'team';
  }

  equals(other: ToolActingAs): boolean {
    return (
      this.linkedAccount === other.linkedAccount &&
      (this.personId === null
        ? other.personId === null
        : other.personId !== null && this.personId.equals(other.personId))
    );
  }
}
