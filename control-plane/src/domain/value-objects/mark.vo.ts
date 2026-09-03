import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';

/** Named by its source first, the way a happening is, and for the reason. */
const KIND = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

/**
 * A handle the world outside knows a task by. A pull request has an address,
 * an issue tracker has a key, an alert has a fingerprint: each is a different
 * kind of handle, and none of them is a task id.
 *
 * What makes a mark worth having is that a source can mint its own. Bringing
 * a delivery home is then the same question every time — which task wears
 * this handle — rather than a new column and a new query per host.
 */
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

    // A handle of nothing would be worn by every task that had none either.
    if (held.length === 0) {
      throw new InvalidIdentifierError('mark', 'is what the world calls it');
    }

    return new Mark(named, held);
  }

  /** The one handle Spotlight hands out itself, by opening the thing. */
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
