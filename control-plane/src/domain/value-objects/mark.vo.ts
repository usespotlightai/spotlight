import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';

const KIND = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

export class Mark {
  private constructor(
    readonly kind: string,
    readonly value: string,
  ) {}

  static of(kind: string, value: string): Mark {
    const named = kind.trim();
    const held = value.trim();

    if (!KIND.test(named)) {
      throw new InvalidIdentifierError(
        'mark',
        'is its source and its name, as in git.pull-request',
      );
    }

    if (held.length === 0) {
      throw new InvalidIdentifierError('mark', 'is what the world calls it');
    }

    return new Mark(named, held);
  }

  static pullRequest(url: PullRequestUrl): Mark {
    return Mark.of('git.pull-request', url.value);
  }

  equals(other: Mark): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return `${this.kind}:${this.value}`;
  }
}
