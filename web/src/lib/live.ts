import { useSyncExternalStore } from 'react';

import type { Position, Sequences } from '@/lib/live-sequences';
import { isOneOf } from '@/lib/one-of';
import { fieldOf, isRecord } from '@/lib/record';

export const LIVE_URL = '/api/me/live';

const LIVE_POLL_MS = 60_000;

export const LIVE_BATCH_MS = 150;

const LIVE_TOPICS = ['chat', 'task', 'run', 'inbox', 'workspaces'] as const;

type LiveTopic = (typeof LIVE_TOPICS)[number];

export const STALE_MS = 30_000;

export interface LiveChange {
  readonly topic: LiveTopic;
  readonly ids: Readonly<Record<string, string>>;
  readonly position?: Position;
}

export interface LiveReady {
  readonly complete: boolean;
  readonly heads: Sequences;
}

const isTopic = (value: unknown): value is LiveTopic =>
  isOneOf(LIVE_TOPICS, value);

export const parsed = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const changeOf = (data: string): LiveChange | null => {
  const change = parsed(data);

  if (
    !isRecord(change) ||
    !isTopic(change.topic) ||
    typeof change.ids !== 'object' ||
    change.ids === null
  ) {
    return null;
  }

  const ids = Object.fromEntries(
    Object.entries(change.ids).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

  return {
    topic: change.topic,
    ids,
    ...(typeof change.channel === 'string' &&
    typeof change.sequence === 'number' &&
    Number.isSafeInteger(change.sequence)
      ? {
          position: {
            channel: change.channel,
            sequence: change.sequence,
          },
        }
      : {}),
  };
};

export const readyOf = (data: string): LiveReady => {
  const ready = parsed(data);
  const given = fieldOf(ready, 'heads');
  const heads =
    typeof given === 'object' && given !== null
      ? Object.fromEntries(
          Object.entries(given).filter((entry): entry is [string, number] =>
            Number.isSafeInteger(entry[1]),
          ),
        )
      : {};

  return { complete: fieldOf(ready, 'complete') === true, heads };
};

let fresh = false;

export const setFresh = (value: boolean): void => {
  fresh = value;
};

export const liveStaleTime = (): number => (fresh ? Infinity : STALE_MS);

let connected = false;
const watchers = new Set<() => void>();

export const setLive = (live: boolean): void => {
  if (connected === live) {
    return;
  }

  connected = live;

  for (const watcher of watchers) {
    watcher();
  }
};

const watch = (watcher: () => void): (() => void) => {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
};

export const isLive = (): boolean => connected;

function useLive(): boolean {
  return useSyncExternalStore(watch, isLive, () => false);
}

export function useLivePoll(pollMs: number): number {
  return useLive() ? LIVE_POLL_MS : pollMs;
}
