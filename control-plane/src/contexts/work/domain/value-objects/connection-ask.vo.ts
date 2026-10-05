import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ConnectionAsk {
  private constructor(
    readonly teamId: TeamId,
    readonly source: string,
    readonly integration: string,
    readonly personId: UserId,
    readonly met: boolean,
  ) {}

  static of(input: {
    teamId: TeamId;
    source: string;
    integration: string;
    personId: UserId;
    met?: boolean;
  }): ConnectionAsk {
    return new ConnectionAsk(
      input.teamId,
      input.source,
      input.integration.trim() || input.source,
      input.personId,
      input.met ?? false,
    );
  }

  answeredBy(teamId: TeamId, source: string, personId: UserId): boolean {
    return (
      !this.met &&
      this.teamId.equals(teamId) &&
      this.source === source &&
      this.personId.equals(personId)
    );
  }

  fulfilled(): ConnectionAsk {
    return new ConnectionAsk(
      this.teamId,
      this.source,
      this.integration,
      this.personId,
      true,
    );
  }

  equals(other: ConnectionAsk): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.source === other.source &&
      this.personId.equals(other.personId) &&
      this.met === other.met
    );
  }
}
