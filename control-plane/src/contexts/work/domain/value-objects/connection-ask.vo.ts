import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ConnectionAsk {
  private constructor(
    readonly teamId: TeamId,
    readonly integration: string,
    readonly integrationName: string,
    readonly personId: UserId,
    readonly met: boolean,
  ) {}

  static of(input: {
    teamId: TeamId;
    integration: string;
    integrationName: string;
    personId: UserId;
    met?: boolean;
  }): ConnectionAsk {
    return new ConnectionAsk(
      input.teamId,
      input.integration,
      input.integrationName.trim() || input.integration,
      input.personId,
      input.met ?? false,
    );
  }

  answeredBy(teamId: TeamId, integration: string, personId: UserId): boolean {
    return (
      !this.met &&
      this.teamId.equals(teamId) &&
      this.integration === integration &&
      this.personId.equals(personId)
    );
  }

  fulfilled(): ConnectionAsk {
    return new ConnectionAsk(
      this.teamId,
      this.integration,
      this.integrationName,
      this.personId,
      true,
    );
  }

  equals(other: ConnectionAsk): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.integration === other.integration &&
      this.personId.equals(other.personId) &&
      this.met === other.met
    );
  }
}
