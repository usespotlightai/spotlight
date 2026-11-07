import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { IntegrationName } from '@work/domain/value-objects/integration-name.vo';

export type MissingConnection =
  | 'not-connected'
  | 'refresh-failed'
  | 'no-requester'
  | 'not-a-member';

export class ConnectionAsk {
  private constructor(
    readonly teamId: TeamId,
    readonly integration: IntegrationName,
    readonly providedBy: string,
    readonly personId: UserId,
    readonly met: boolean,
  ) {}

  static of(input: {
    teamId: TeamId;
    integration: IntegrationName;
    providedBy: string;
    personId: UserId;
    met?: boolean;
  }): ConnectionAsk {
    return new ConnectionAsk(
      input.teamId,
      input.integration,
      input.providedBy.trim() || input.integration.value,
      input.personId,
      input.met ?? false,
    );
  }

  static askableWhen(because: MissingConnection): boolean {
    return because === 'not-connected' || because === 'refresh-failed';
  }

  answeredBy(
    teamId: TeamId,
    integration: IntegrationName,
    personId: UserId,
  ): boolean {
    return (
      !this.met &&
      this.teamId.equals(teamId) &&
      this.integration.equals(integration) &&
      this.personId.equals(personId)
    );
  }

  fulfilled(): ConnectionAsk {
    return new ConnectionAsk(
      this.teamId,
      this.integration,
      this.providedBy,
      this.personId,
      true,
    );
  }

  equals(other: ConnectionAsk): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.integration.equals(other.integration) &&
      this.personId.equals(other.personId) &&
      this.met === other.met
    );
  }
}
