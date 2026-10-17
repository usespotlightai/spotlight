import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type ConnectionMissingReason =
  | 'not-connected'
  | 'refresh-failed'
  | 'no-requester'
  | 'not-a-member';

export class ConnectionMissing {
  private constructor(
    readonly integration: IntegrationKey,
    readonly integrationName: string,
    readonly personId: UserId | null,
    readonly because: ConnectionMissingReason,
  ) {}

  static of(input: {
    integration: IntegrationKey;
    integrationName: string;
    personId: UserId | null;
    because: ConnectionMissingReason;
  }): ConnectionMissing {
    return new ConnectionMissing(
      input.integration,
      input.integrationName,
      input.personId,
      input.because,
    );
  }

  equals(other: ConnectionMissing): boolean {
    return (
      this.integration.equals(other.integration) &&
      this.because === other.because &&
      (this.personId === null
        ? other.personId === null
        : other.personId !== null && this.personId.equals(other.personId))
    );
  }
}
