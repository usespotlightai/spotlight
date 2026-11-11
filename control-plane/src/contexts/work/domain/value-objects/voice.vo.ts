import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidVoiceError } from '@work/domain/exceptions/invalid-voice.error';

export const VOICE_KINDS = ['station', 'person', 'world'] as const;

export type VoiceKind = (typeof VOICE_KINDS)[number];

export class Voice {
  private constructor(
    readonly kind: VoiceKind,
    readonly author: UserId | null,
    readonly run: RunId | null,
    readonly coAuthors: readonly UserId[] = [],
    readonly source: string | null = null,
  ) {}

  static station(run: RunId | null = null): Voice {
    return new Voice('station', null, run);
  }

  static person(author: UserId, coAuthors: readonly UserId[] = []): Voice {
    const others = coAuthors.filter(
      (each, at) =>
        !each.equals(author) &&
        coAuthors.findIndex((other) => other.equals(each)) === at,
    );

    return new Voice('person', author, null, others);
  }

  static world(
    author: UserId | null = null,
    source: string | null = null,
  ): Voice {
    return new Voice('world', author, null, [], source);
  }

  static of(input: {
    kind: string;
    author?: string | null;
    coAuthors?: readonly string[];
    run?: string | null;
    source?: string | null;
  }): Voice {
    if (input.source && input.kind !== 'world') {
      throw new InvalidVoiceError(
        `with a source belongs to the world, not to ${input.kind}`,
      );
    }

    if (input.kind === 'person') {
      if (!input.author) {
        throw new InvalidVoiceError('of a person needs their name');
      }

      return Voice.person(
        UserId.of(input.author),
        (input.coAuthors ?? []).map(UserId.of),
      );
    }

    if (input.coAuthors?.length) {
      throw new InvalidVoiceError(
        `with co-authors belongs to a person, not to ${input.kind}`,
      );
    }

    if (input.kind === 'world') {
      if (input.run) {
        throw new InvalidVoiceError('of the world names no run');
      }

      return Voice.world(
        input.author ? UserId.of(input.author) : null,
        input.source ?? null,
      );
    }

    if (input.author) {
      throw new InvalidVoiceError(
        `with a name belongs to a person, not to ${input.kind}`,
      );
    }

    if (input.kind !== 'station') {
      throw new InvalidVoiceError(`must be one of ${VOICE_KINDS.join(', ')}`);
    }

    return Voice.station(input.run ? RunId.of(input.run) : null);
  }

  equals(other: Voice): boolean {
    return (
      this.kind === other.kind &&
      this.source === other.source &&
      (this.author === null
        ? other.author === null
        : other.author !== null && this.author.equals(other.author)) &&
      (this.run === null
        ? other.run === null
        : other.run !== null && this.run.equals(other.run)) &&
      this.coAuthors.length === other.coAuthors.length &&
      this.coAuthors.every((each, at) => {
        const theirs = other.coAuthors[at];
        return theirs !== undefined && each.equals(theirs);
      })
    );
  }

  get isStation(): boolean {
    return this.kind === 'station';
  }

  get isPerson(): boolean {
    return this.kind === 'person';
  }

  get isWorld(): boolean {
    return this.kind === 'world';
  }
}
