import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { type Block, isBlock } from '@replays/domain/value-objects/block-shape';

const MOST_CHARACTERS = 64_000;

export class PlannedLine {
  private constructor(private readonly written: string) {}

  static of(held: unknown): PlannedLine {
    const repositories = isBlock(held) ? held.repositories : undefined;

    if (!Array.isArray(repositories) || !repositories.every(isBlock)) {
      throw new InvalidCandidateError(
        'planned with its line names the line’s repositories, as the line holds them',
      );
    }

    const written = JSON.stringify({ repositories });

    if (written.length > MOST_CHARACTERS) {
      throw new InvalidCandidateError(
        `planned with its line holds at most ${MOST_CHARACTERS} characters of it`,
      );
    }

    return new PlannedLine(written);
  }

  get repositories(): readonly Block[] {
    return (JSON.parse(this.written) as { repositories: Block[] }).repositories;
  }

  get value(): { readonly repositories: readonly Block[] } {
    return { repositories: this.repositories };
  }
}
