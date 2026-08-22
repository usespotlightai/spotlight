import { InvalidTeamNameError } from '@domain/exceptions/invalid-team-name.error';

const MAX_LENGTH = 100;

export class TeamName {
  private constructor(readonly value: string) {}

  static of(raw: string): TeamName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidTeamNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidTeamNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new TeamName(trimmed);
  }

  equals(other: TeamName): boolean {
    return this.value === other.value;
  }
}
