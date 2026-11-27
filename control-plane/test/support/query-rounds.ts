import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { setTimeout as slept } from 'node:timers/promises';

import type { INestApplication } from '@nestjs/common';
import { Client, Pool } from 'pg';
import type { Test } from 'supertest';

import { httpServerOf } from './http-server';

const ROUND_TRIP_MS = 15;

const PROBE_HEADER = 'x-query-rounds-probe';

interface Query {
  readonly text: string;
  readonly started: number;
  ended: number;
}

interface Recording {
  readonly queries: Query[];
  open: boolean;
}

const recording = new AsyncLocalStorage<Recording>();
const recordings = new Map<string, Recording>();

const PATCHED = Symbol.for('spotlight.e2e.query-rounds');

const textOf = (first: unknown): string => {
  if (typeof first === 'string') {
    return first;
  }

  return typeof first === 'object' &&
    first !== null &&
    'text' in first &&
    typeof first.text === 'string'
    ? first.text
    : '';
};

if (Reflect.get(globalThis, PATCHED) !== true) {
  Reflect.set(globalThis, PATCHED, true);

  const connect = Pool.prototype.connect as (...args: unknown[]) => unknown;

  // A waiting checkout is answered in the async context of the query that released its client.
  Object.defineProperty(Pool.prototype, 'connect', {
    value: function (this: Pool, ...args: unknown[]) {
      const [callback] = args;

      return typeof callback === 'function'
        ? connect.call(
            this,
            AsyncResource.bind((...results: unknown[]): void => {
              Reflect.apply(callback, undefined, results);
            }),
          )
        : connect.apply(this, args);
    },
    writable: true,
    configurable: true,
  });

  const query = Client.prototype.query as (...args: unknown[]) => unknown;

  const patched = function (this: Client, ...args: unknown[]) {
    const current = recording.getStore();
    const [first] = args;

    const submittable =
      typeof first === 'object' &&
      first !== null &&
      typeof (first as { submit?: unknown }).submit === 'function';

    if (!current?.open || submittable) {
      return query.apply(this, args);
    }

    const entry: Query = {
      text: textOf(first),
      started: performance.now(),
      ended: Number.POSITIVE_INFINITY,
    };
    current.queries.push(entry);

    const callback = args.findIndex((each) => typeof each === 'function');

    const answer = callback >= 0 ? args[callback] : undefined;

    if (typeof answer === 'function') {
      const rest = [...args];
      const answered = (...results: unknown[]): void => {
        Reflect.apply(answer, undefined, results);
      };

      rest[callback] = (...results: unknown[]) => {
        entry.ended = performance.now();
        answered(...results);
      };
      void slept(ROUND_TRIP_MS).then(() => {
        try {
          query.apply(this, rest);
        } catch (error) {
          answered(error);
        }
      });

      return undefined;
    }

    return slept(ROUND_TRIP_MS)
      .then(() => query.apply(this, args))
      .finally(() => {
        entry.ended = performance.now();
      });
  };

  Object.defineProperty(Client.prototype, 'query', {
    value: patched,
    writable: true,
    configurable: true,
  });
}

const PROBED = new WeakSet<Server>();

const probed = (app: INestApplication): Server => {
  const server = httpServerOf(app);

  if (PROBED.has(server)) {
    return server;
  }

  const listeners = server.listeners('request') as ((
    request: IncomingMessage,
    response: ServerResponse,
  ) => void)[];

  server.removeAllListeners('request');
  server.on('request', (request, response) => {
    const id = request.headers[PROBE_HEADER];
    const found = typeof id === 'string' ? recordings.get(id) : undefined;
    const handle = () => {
      for (const listener of listeners) {
        listener.call(server, request, response);
      }
    };

    if (!found) {
      handle();
      return;
    }

    response.on('finish', () => {
      found.open = false;
    });
    recording.run(found, handle);
  });
  PROBED.add(server);

  return server;
};

export interface Rounds {
  readonly rounds: number;
  readonly queries: number;
  readonly texts: readonly string[];
}

const roundsIn = (queries: readonly Query[]): number => {
  const sorted = [...queries].sort((a, b) => a.started - b.started);
  const depths: number[] = [];

  for (const each of sorted) {
    const before = sorted
      .slice(0, depths.length)
      .map((earlier, at) => (earlier.ended <= each.started ? depths[at] : 0));

    depths.push(Math.max(0, ...before) + 1);
  }

  return Math.max(0, ...depths);
};

const summaryOf = (found: Recording): Rounds => ({
  rounds: roundsIn(found.queries),
  queries: found.queries.length,
  texts: found.queries.map((each) => each.text),
});

export const queryRoundsOf = async (
  app: INestApplication,
  sent: (probe: (test: Test) => Test) => Test,
): Promise<Rounds> => {
  probed(app);

  const id = randomUUID();
  const found: Recording = { queries: [], open: true };

  recordings.set(id, found);

  try {
    await sent((test) => test.set(PROBE_HEADER, id));
  } finally {
    recordings.delete(id);
    found.open = false;
  }

  return summaryOf(found);
};

export const queryRoundsDuring = async (
  work: () => Promise<unknown>,
): Promise<Rounds> => {
  const found: Recording = { queries: [], open: true };

  try {
    await recording.run(found, work);
  } finally {
    found.open = false;
  }

  return summaryOf(found);
};
