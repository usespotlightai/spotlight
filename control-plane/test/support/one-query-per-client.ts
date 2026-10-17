import { Client } from 'pg';
import { afterEach, expect } from 'vitest';

interface Queueing {
  readonly _activeQuery: { readonly text?: string } | null;
  readonly _queryQueue: readonly unknown[];
}

const OVERLAPS = Symbol.for('spotlight.e2e.overlapping-queries');
const shared = globalThis as { [OVERLAPS]?: string[] };

if (!shared[OVERLAPS]) {
  const overlaps: string[] = [];
  const query = Client.prototype.query as (...given: unknown[]) => unknown;

  shared[OVERLAPS] = overlaps;
  Client.prototype.query = function (
    this: Client & Queueing,
    ...given: unknown[]
  ) {
    if (this._activeQuery || this._queryQueue.length > 0) {
      const [asked] = given;
      const text =
        typeof asked === 'string' ? asked : (asked as { text?: string }).text;

      overlaps.push(`${text}\n  while running: ${this._activeQuery?.text}`);
    }

    return query.apply(this, given);
  } as Client['query'];
}

// pg@9 rejects a query while the client runs another; inside a transaction every query shares one client.
afterEach(() => {
  const taken = shared[OVERLAPS]?.splice(0) ?? [];

  expect(taken, 'Queries overlapped on one pg client').toEqual([]);
});
