import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamMemberJoined } from '@identity/domain/events/team-member-joined.event';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Team extends EventRecorder {
  private constructor(
    readonly id: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly key: TeamKey,
    readonly name: TeamName,
    readonly members: readonly UserId[],
    readonly version: number = 0,
  ) {
    super();
  }

  static open(input: {
    id: TeamId;
    workspaceId: WorkspaceId;
    name: TeamName;
    key?: TeamKey;
    openedBy: UserId;
  }): Team {
    const team = new Team(
      input.id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      [input.openedBy],
    );

    team.record(new TeamCreated(input.workspaceId, input.id, input.openedBy));

    return team;
  }

  static rehydrate(input: {
    id: TeamId;
    workspaceId: WorkspaceId;
    key?: TeamKey;
    name: TeamName;
    members: readonly UserId[];
    version?: number;
  }): Team {
    if (input.members.length === 0) {
      throw new InconsistentStateError('team', 'has no members at all');
    }

    return new Team(
      input.id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      input.members,
      input.version ?? 0,
    );
  }

  holds(userId: UserId): boolean {
    return this.members.some((each) => each.equals(userId));
  }

  joinedBy(userId: UserId): Team {
    if (this.holds(userId)) {
      return this;
    }

    const joined = this.reshaped({ members: [...this.members, userId] });

    joined.record(new TeamMemberJoined(this.id, userId));

    return joined;
  }

  renamedTo(name: TeamName): Team {
    return name.equals(this.name) ? this : this.reshaped({ name });
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }

  private reshaped(over: Partial<Pick<Team, 'name' | 'members'>>): Team {
    const next = new Team(
      this.id,
      this.workspaceId,
      this.key,
      over.name ?? this.name,
      over.members ?? this.members,
      this.version,
    );
    next.inheritEvents(this);

    return next;
  }
}
