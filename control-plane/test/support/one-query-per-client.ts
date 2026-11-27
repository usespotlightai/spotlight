import { Client } from 'pg';
import { afterEach } from 'vitest';

interface Queueing {
  readonly _activeQuery: { readonly text?: string } | null;
  readonly _queryQueue: readonly unknown[];
}

const OVERLAPS = Symbol.for('spotlight.e2e.overlapping-queries');

const isString = (value: unknown): value is string => typeof value === 'string';

const textOf = (first: unknown): string | undefined => {
  if (typeof first === 'string') {
    return first;
  }

  return typeof first === 'object' &&
    first !== null &&
    'text' in first &&
    typeof first.text === 'string'
    ? first.text
    : undefined;
};

if (!Array.isArray(Reflect.get(globalThis, OVERLAPS))) {
  const overlaps: string[] = [];
  const query = Client.prototype.query as (...args: unknown[]) => unknown;

  Reflect.set(globalThis, OVERLAPS, overlaps);
  Object.defineProperty(Client.prototype, 'query', {
    value: function (this: Client & Queueing, ...args: unknown[]) {
      if (this._activeQuery || this._queryQueue.length > 0) {
        const [first] = args;

        overlaps.push(
          `${textOf(first)}\n  while running: ${this._activeQuery?.text}`,
        );
      }

      return query.apply(this, args);
    },
    writable: true,
    configurable: true,
  });
}

// pg@9 rejects a query while the client runs another; inside a transaction every query shares one client.
afterEach(() => {
  const shared: unknown = Reflect.get(globalThis, OVERLAPS);
  const taken = Array.isArray(shared) ? shared.splice(0).filter(isString) : [];

  if (taken.length > 0) {
    throw new Error(
      `Queries overlapped on one pg client:\n${taken.join('\n')}`,
    );
  }
});
