import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { type Block, isBlock } from '@replays/domain/value-objects/block-shape';

const MAX_CHARACTERS = 256_000;

export class StationBlock {
  private constructor(
    readonly key: string,
    private readonly written: string,
  ) {}

  static of(raw: unknown): StationBlock {
    if (!isBlock(raw) || typeof raw.key !== 'string') {
      throw new InvalidCandidateError(
        'must contain a station block with its key',
      );
    }

    const written = JSON.stringify(raw);

    if (written.length > MAX_CHARACTERS) {
      throw new InvalidCandidateError(
        `station block must be at most ${MAX_CHARACTERS} characters`,
      );
    }

    return new StationBlock(raw.key, written);
  }

  get value(): Block {
    return JSON.parse(this.written) as Block;
  }

  equals(other: StationBlock): boolean {
    return this.written === other.written;
  }
}
