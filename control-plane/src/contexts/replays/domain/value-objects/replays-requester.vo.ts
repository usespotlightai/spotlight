import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface PublishedRequester {
  readonly owner: string;
  readonly kind: string;
  readonly id: string;
  readonly token: string | null;
}

export interface SearchIteration {
  readonly searchId: SearchId;
  readonly iteration: number;
}

export const REPLAYS_OWNER = 'replays';

const ITERATION = /^(0|[1-9][0-9]*)$/;

type Requested =
  | { readonly kind: 'replay'; readonly run: string }
  | {
      readonly kind: 'search';
      readonly searchId: SearchId;
      readonly iteration: number;
    };

export class ReplaysRequester {
  private constructor(private readonly requested: Requested) {}

  static replayOf(run: RunId): ReplaysRequester {
    return new ReplaysRequester({ kind: 'replay', run: run.value });
  }

  static searchIteration(
    searchId: SearchId,
    iteration: number,
  ): ReplaysRequester {
    return new ReplaysRequester({ kind: 'search', searchId, iteration });
  }

  static decode(published: PublishedRequester): ReplaysRequester | null {
    if (published.owner !== REPLAYS_OWNER) {
      return null;
    }

    if (published.kind === 'replay') {
      return new ReplaysRequester({ kind: 'replay', run: published.id });
    }

    if (
      published.kind === 'search' &&
      published.token !== null &&
      ITERATION.test(published.token)
    ) {
      return ReplaysRequester.searchIteration(
        SearchId.of(published.id),
        Number(published.token),
      );
    }

    return null;
  }

  get isReplay(): boolean {
    return this.requested.kind === 'replay';
  }

  get searchIteration(): SearchIteration | null {
    return this.requested.kind === 'search'
      ? {
          searchId: this.requested.searchId,
          iteration: this.requested.iteration,
        }
      : null;
  }

  encoded(): PublishedRequester {
    return this.requested.kind === 'replay'
      ? {
          owner: REPLAYS_OWNER,
          kind: 'replay',
          id: this.requested.run,
          token: null,
        }
      : {
          owner: REPLAYS_OWNER,
          kind: 'search',
          id: this.requested.searchId.value,
          token: String(this.requested.iteration),
        };
  }

  equals(other: ReplaysRequester): boolean {
    const mine = this.encoded();
    const theirs = other.encoded();

    return (
      mine.kind === theirs.kind &&
      mine.id === theirs.id &&
      mine.token === theirs.token
    );
  }
}
