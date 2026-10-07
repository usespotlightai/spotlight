import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';

const MOST_LENGTH = 200;

const named = (raw: string | null, what: string): string | null => {
  if (raw === null) {
    return null;
  }

  const held = raw.trim();

  if (held.length === 0 || held.length > MOST_LENGTH) {
    throw new InvalidSearchError(
      `agent ${what} must be 1 to ${MOST_LENGTH} characters, or left out`,
    );
  }

  return held;
};

export class SearchAgent {
  private constructor(
    readonly harness: string,
    readonly model: string | null,
    readonly effort: string | null,
  ) {}

  static of(input: {
    harness: string;
    model: string | null;
    effort: string | null;
  }): SearchAgent {
    const harness = named(input.harness, 'harness');

    if (harness === null) {
      throw new InvalidSearchError('agent harness is required');
    }

    return new SearchAgent(
      harness,
      named(input.model, 'model'),
      named(input.effort, 'effort'),
    );
  }

  equals(other: SearchAgent): boolean {
    return (
      this.harness === other.harness &&
      this.model === other.model &&
      this.effort === other.effort
    );
  }
}
