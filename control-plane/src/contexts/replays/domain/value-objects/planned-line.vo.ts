import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { type Block, isBlock } from '@replays/domain/value-objects/block-shape';

const MAX_CHARACTERS = 64_000;

export class PlannedLine {
  private constructor(private readonly written: string) {}

  static of(raw: unknown): PlannedLine {
    const repositories = isBlock(raw) ? raw.repositories : undefined;

    if (!Array.isArray(repositories) || !repositories.every(isBlock)) {
      throw new InvalidCandidateError(
        'planned line must name the line’s repositories',
      );
    }

    const written = JSON.stringify({ repositories });

    if (written.length > MAX_CHARACTERS) {
      throw new InvalidCandidateError(
        `planned line must be at most ${MAX_CHARACTERS} characters`,
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
