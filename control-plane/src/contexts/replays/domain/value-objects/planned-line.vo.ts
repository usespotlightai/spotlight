import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { type Block, isBlock } from '@replays/domain/value-objects/block-shape';

const MOST_CHARACTERS = 64_000;

export class PlannedLine {
  private constructor(private readonly written: string) {}

  static of(held: unknown): PlannedLine {
    const repositories = isBlock(held) ? held.repositories : undefined;

    if (!Array.isArray(repositories) || !repositories.every(isBlock)) {
      throw new InvalidCandidateError(
        'planned line must name the line’s repositories',
      );
    }

    const written = JSON.stringify({ repositories });

    if (written.length > MOST_CHARACTERS) {
      throw new InvalidCandidateError(
        `planned line must be at most ${MOST_CHARACTERS} characters`,
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
