import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidVoiceError } from '@work/domain/exceptions/invalid-voice.error';

export const VOICES = ['station', 'person', 'world'] as const;

export type SpokenBy = (typeof VOICES)[number];

export class Voice {
  private constructor(
    readonly by: SpokenBy,
    readonly author: UserId | null,
    readonly run: RunId | null,
  ) {}

  static station(run: RunId | null = null): Voice {
    return new Voice('station', null, run);
  }

  static person(author: UserId): Voice {
    return new Voice('person', author, null);
  }

  static world(): Voice {
    return new Voice('world', null, null);
  }

  static of(input: {
    by: string;
    author?: string | null;
    run?: string | null;
  }): Voice {
    if (input.by === 'person') {
      if (!input.author) {
        throw new InvalidVoiceError('of a person needs their name');
      }

      return Voice.person(UserId.of(input.author));
    }

    if (input.author) {
      throw new InvalidVoiceError(
        `with a name belongs to a person, not to ${input.by}`,
      );
    }

    if (input.by === 'world') {
      if (input.run) {
        throw new InvalidVoiceError('of the world names no run');
      }

      return Voice.world();
    }

    if (input.by !== 'station') {
      throw new InvalidVoiceError(`must be one of ${VOICES.join(', ')}`);
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
