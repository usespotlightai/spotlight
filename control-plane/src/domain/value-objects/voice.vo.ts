import { InvalidVoiceError } from '@domain/exceptions/invalid-voice.error';
import { RunId } from '@domain/value-objects/run-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export const VOICES = ['station', 'person', 'world'] as const;

export type SpokenBy = (typeof VOICES)[number];

/** Who spoke, which is not what they did, and what identifies them. */
export class Voice {
  private constructor(
    readonly by: SpokenBy,
    readonly author: UserId | null,
    readonly run: RunId | null,
  ) {}

  /** The run that ended saying it, or nobody where the board moved a task. */
  static station(run: RunId | null = null): Voice {
    return new Voice('station', null, run);
  }

  static person(author: UserId): Voice {
    return new Voice('person', author, null);
  }

  static world(): Voice {
    return new Voice('world', null, null);
  }

  /** Read back from storage, where any of the three may be a lie. */
  static of(input: {
    by: string;
    author?: string | null;
    run?: string | null;
  }): Voice {
    if (input.by === 'person') {
      if (!input.author) {
        throw new InvalidVoiceError('is a person’s, so it needs their name');
      }

      return Voice.person(UserId.of(input.author));
    }

    if (input.author) {
      throw new InvalidVoiceError(
        `carries a name, so it is a person’s and not ${input.by}’s`,
      );
    }

    if (input.by === 'world') {
      if (input.run) {
        throw new InvalidVoiceError('is the world’s, so no run of ours spoke');
      }

      return Voice.world();
    }

    if (input.by !== 'station') {
      throw new InvalidVoiceError(`is none of ${VOICES.join(', ')}`);
    }

    return Voice.station(input.run ? RunId.of(input.run) : null);
  }

  equals(other: Voice): boolean {
    return (
      this.by === other.by &&
      (this.author === null
        ? other.author === null
        : other.author !== null && this.author.equals(other.author)) &&
      (this.run === null
        ? other.run === null
        : other.run !== null && this.run.equals(other.run))
    );
  }

  get isStation(): boolean {
    return this.by === 'station';
  }

  get isPerson(): boolean {
    return this.by === 'person';
  }

  get isWorld(): boolean {
    return this.by === 'world';
  }
}
