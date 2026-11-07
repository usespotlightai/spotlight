import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const TEAM = 'team';
const PERSON = 'person:';

export type ConnectionOwnerKind = 'team' | 'person';

export class ConnectionOwner {
  private constructor(readonly personId: UserId | null) {}

  static team(): ConnectionOwner {
    return new ConnectionOwner(null);
  }

  static person(personId: UserId): ConnectionOwner {
    return new ConnectionOwner(personId);
  }

  static ofKind(kind: ConnectionOwnerKind, by: UserId): ConnectionOwner {
    return kind === 'person'
      ? ConnectionOwner.person(by)
      : ConnectionOwner.team();
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

  get kind(): ConnectionOwnerKind {
    return this.personId ? 'person' : 'team';
  }

  mayBeConnectedBy(person: UserId, isAdmin: boolean): boolean {
    return this.personId ? this.personId.equals(person) : isAdmin;
  }

  equals(other: ConnectionOwner): boolean {
    return this.key === other.key;
  }
}
