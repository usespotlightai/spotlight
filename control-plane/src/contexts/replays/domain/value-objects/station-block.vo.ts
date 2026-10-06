import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { type Block, isBlock } from '@replays/domain/value-objects/block-shape';

const MOST_CHARACTERS = 256_000;

export class StationBlock {
  private constructor(
    readonly key: string,
    private readonly written: string,
  ) {}

  static of(held: unknown): StationBlock {
    if (!isBlock(held) || typeof held.key !== 'string') {
      throw new InvalidCandidateError('must hold a station block with its key');
    }

    const written = JSON.stringify(held);

    if (written.length > MOST_CHARACTERS) {
      throw new InvalidCandidateError(
        `station block must be at most ${MOST_CHARACTERS} characters`,
      );
    }

    return new StationBlock(held.key, written);
  }

  get value(): Block {
    return JSON.parse(this.written) as Block;
  }

  equals(other: StationBlock): boolean {
    return this.written === other.written;
  }
}
