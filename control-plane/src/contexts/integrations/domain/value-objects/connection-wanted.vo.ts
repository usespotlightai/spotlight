import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type ConnectionWant =
  | 'not-connected'
  | 'refresh-failed'
  | 'no-requester'
  | 'not-a-member';

export class ConnectionWanted {
  private constructor(
    readonly source: SourceKey,
    readonly integrationName: string,
    readonly personId: UserId | null,
    readonly because: ConnectionWant,
  ) {}

  static of(input: {
    source: SourceKey;
    integrationName: string;
    personId: UserId | null;
    because: ConnectionWant;
  }): ConnectionWanted {
    return new ConnectionWanted(
      input.source,
      input.integrationName,
      input.personId,
      input.because,
    );
  }

  equals(other: ConnectionWanted): boolean {
    return (
      this.source.equals(other.source) &&
      this.because === other.because &&
      (this.personId === null
        ? other.personId === null
        : other.personId !== null && this.personId.equals(other.personId))
    );
  }
}
