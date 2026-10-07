import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { areWords } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SEPARATOR = '/';

const refused = (): never => {
  throw new InvalidIdentifierError(
    'address',
    'must be a team key and a key, such as core/delivery',
  );
};

export class TeamAddress {
  private readonly kind = 'team-address';

  private constructor(
    readonly teamKey: string,
    readonly key: string,
  ) {}

  static of(teamKey: string, key: string): TeamAddress {
    return areWords(teamKey) && areWords(key)
      ? new TeamAddress(teamKey, key)
      : refused();
  }

  static parse(held: string): TeamAddress {
    const [teamKey, key, ...rest] = held.trim().split(SEPARATOR);

    return teamKey && key && rest.length === 0
      ? TeamAddress.of(teamKey, key)
      : refused();
  }

  equals(other: TeamAddress): boolean {
    return (
      this.kind === other.kind &&
      this.teamKey === other.teamKey &&
      this.key === other.key
    );
  }

  toString(): string {
    return [this.teamKey, this.key].join(SEPARATOR);
  }
}
