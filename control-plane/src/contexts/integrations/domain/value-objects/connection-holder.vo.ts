import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const TEAM = 'team';
const PERSON = 'person:';

export class ConnectionHolder {
  private constructor(readonly personId: UserId | null) {}

  static team(): ConnectionHolder {
    return new ConnectionHolder(null);
  }

  static person(personId: UserId): ConnectionHolder {
    return new ConnectionHolder(personId);
  }

  static fromKey(key: string): ConnectionHolder {
    if (key === TEAM) {
      return ConnectionHolder.team();
    }

    if (key.startsWith(PERSON)) {
      return ConnectionHolder.person(UserId.of(key.slice(PERSON.length)));
    }

    throw new InvalidIdentifierError(
      'connection holder',
      'is the team, or a person in it',
    );
  }

  get isPerson(): boolean {
    return this.personId !== null;
  }

  get key(): string {
    return this.personId ? `${PERSON}${this.personId.value}` : TEAM;
  }

  equals(other: ConnectionHolder): boolean {
    return this.key === other.key;
  }
}
