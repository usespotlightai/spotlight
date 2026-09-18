import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class TeamId {
  private readonly kind = 'team';

  private constructor(readonly value: string) {}

  static of(value: string): TeamId {
    if (value.trim().length === 0) {
      throw new InvalidIdentifierError('team');
    }
    return new TeamId(value);
  }

  equals(other: TeamId): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
