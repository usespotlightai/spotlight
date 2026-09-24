import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamDisbanded } from '@identity/domain/events/team-disbanded.event';
import { TeamMemberJoined } from '@identity/domain/events/team-member-joined.event';
import { TeamRedefined } from '@identity/domain/events/team-redefined.event';
import { TeamInUseError } from '@identity/domain/exceptions/team-in-use.error';
import { TeamKeyFixedError } from '@identity/domain/exceptions/team-key-fixed.error';
import { TeamMovedOnError } from '@identity/domain/exceptions/team-moved-on.error';
import type { Holdings } from '@identity/domain/value-objects/holdings.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Opening {
  readonly id: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly name: TeamName;
  readonly key?: TeamKey;
  readonly openedBy: UserId;
  readonly by: Attribution;
}

export class Team extends EventRecorder {
  private constructor(
    readonly id: TeamId,
    readonly workspaceId: WorkspaceId,
    readonly key: TeamKey,
    readonly name: TeamName,
    readonly members: readonly UserId[],
    readonly version: number = 0,
    readonly isDisbanded: boolean = false,
  ) {
    super();
  }

  static open(input: Opening): Team {
    const team = Team.founded(input);

    team.record(
      new TeamCreated(
        input.workspaceId,
        input.id,
        input.openedBy,
        'sign-up',
        ConfigurationChange.created(team.whatChanged, input.by),
      ),
    );

    return team;
  }

  static define(input: Opening & { key: TeamKey }): Team {
    const team = Team.founded(input);

    team.record(
      new TeamCreated(
        input.workspaceId,
        input.id,
        input.openedBy,
        'configuration',
        ConfigurationChange.created(team.whatChanged, input.by),
      ),
    );

    return team;
  }

  private static founded(input: Opening): Team {
    return new Team(
      input.id,
      input.workspaceId,
      input.key ?? TeamKey.from(input.name.value),
      input.name,
      [input.openedBy],
    );
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

  expecting(version: number): void {
    if (version !== this.version) {
      throw new TeamMovedOnError(this.id.value);
    }
  }

  redefinedAs(
    definition: { key: TeamKey; name: TeamName },
    by: Attribution,
  ): Team {
    this.guardStanding();

    if (!definition.key.equals(this.key)) {
      throw new TeamKeyFixedError(
        this.key.value,
        `keeps its key for its whole life, since everything it holds is addressed by it; replace it to key a team ${definition.key.value}`,
      );
    }

    const redefined = this.reshaped({ name: definition.name });

    redefined.record(
      new TeamRedefined(
        this.workspaceId,
        this.id,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  disbanded(holdings: Holdings, by: Attribution): Team {
    this.guardStanding();

    if (!holdings.isEmpty) {
      throw new TeamInUseError(this.key.value, holdings);
    }

    const disbanded = this.reshaped({ disbanded: true });

    disbanded.record(
      new TeamDisbanded(
        this.workspaceId,
        this.id,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return disbanded;
  }

  private get whatChanged() {
    return {
      resource: 'team' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  equals(other: Team): boolean {
    return this.id.equals(other.id);
  }

  private guardStanding(): void {
    if (this.isDisbanded) {
      throw new InconsistentStateError(
        'team',
        'was changed after it was disbanded',
      );
    }
  }

  private reshaped(
    over: Partial<Pick<Team, 'name' | 'members'>> & { disbanded?: boolean },
  ): Team {
    const next = new Team(
      this.id,
      this.workspaceId,
      this.key,
      over.name ?? this.name,
      over.members ?? this.members,
      this.version,
      over.disbanded ?? this.isDisbanded,
    );
    next.inheritEvents(this);

    return next;
  }
}
