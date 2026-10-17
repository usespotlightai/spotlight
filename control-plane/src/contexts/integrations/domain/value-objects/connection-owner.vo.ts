import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const TEAM = 'team';
const PERSON = 'person:';

export class ConnectionOwner {
  private constructor(readonly personId: UserId | null) {}

  static team(): ConnectionOwner {
    return new ConnectionOwner(null);
  }

  static person(personId: UserId): ConnectionOwner {
    return new ConnectionOwner(personId);
  }

  static fromKey(key: string): ConnectionOwner {
    if (key === TEAM) {
      return ConnectionOwner.team();
    }

    if (key.startsWith(PERSON)) {
      return ConnectionOwner.person(UserId.of(key.slice(PERSON.length)));
    }

    throw new InvalidIdentifierError(
      'connection owner',
      'is the team, or a person in it',
    );
  }

  get isPerson(): boolean {
    return this.personId !== null;
  }

  get key(): string {
    return this.personId ? `${PERSON}${this.personId.value}` : TEAM;
  }

  equals(other: ConnectionOwner): boolean {
    return this.key === other.key;
  }
}
