export const LIVE_SEQUENCES_HEADER = 'spotlight-live-sequences';

export const LIVE_SEQUENCES_KEY = ['live', 'sequences'] as const;

const SETTLES_KEPT = 50;

export type Sequences = Readonly<Record<string, number>>;

export interface Position {
  readonly channel: string;
  readonly sequence: number;
}

interface Settle {
  readonly upTo: Sequences;
  readonly kept: ReadonlySet<string>;
}

interface Waiter {
  readonly positions: readonly Position[];
  readonly done: (kept: ReadonlySet<string> | null) => void;
}

export const positionsIn = (header: string | null): Position[] =>
  (header ?? '')
    .split(',')
    .map((each) => {
      const at = each.lastIndexOf('@');
      return {
        channel: each.slice(0, at).trim(),
        sequence: Number(each.slice(at + 1)),
      };
    })
    .filter(
      (position) =>
        position.channel.length > 0 &&
        Number.isSafeInteger(position.sequence) &&
        position.sequence > 0,
    );

export const sinceQuery = (sequences: Sequences): string =>
  new URLSearchParams(
    Object.entries(sequences).map(([channel, sequence]) => [
      'since',
      `${channel}@${sequence}`,
    ]),
  ).toString();

const covers = (sequences: Sequences, positions: readonly Position[]) =>
  positions.every(
    ({ channel, sequence }) => (sequences[channel] ?? 0) >= sequence,
  );

export class LiveSequences {
  #applied = new Map<string, number>();
  #ahead = new Map<string, Set<number>>();
  #settled = new Map<string, number>();
  #settles: Settle[] = [];
  #waiters = new Set<Waiter>();

  reset(stored: Sequences): void {
    this.#applied = new Map(Object.entries(stored));
    this.#settled = new Map(Object.entries(stored));
    this.#ahead.clear();
    this.#settles = [];
  }

  applied(): Sequences {
    return Object.fromEntries(this.#applied);
  }

  settled(): Sequences {
    return Object.fromEntries(this.#settled);
  }

  received({ channel, sequence }: Position): boolean {
    const applied = this.#applied.get(channel);

    if (applied === undefined) {
      return true;
    }

    if (sequence <= applied || this.#ahead.get(channel)?.has(sequence)) {
      return false;
    }

    const ahead = this.#ahead.get(channel) ?? new Set<number>();
    ahead.add(sequence);
    this.#ahead.set(channel, ahead);
    this.#absorbed(channel);

    return true;
  }

  hasGap(): boolean {
    return [...this.#ahead.values()].some((ahead) => ahead.size > 0);
  }

  caughtUp(heads: Sequences): void {
    for (const [channel, head] of Object.entries(heads)) {
      this.#applied.set(
        channel,
        Math.max(this.#applied.get(channel) ?? 0, head),
      );
      this.#absorbed(channel);
    }
  }

  restarted(heads: Sequences): void {
    for (const channel of new Set([
      ...this.#applied.keys(),
      ...Object.keys(heads),
    ])) {
      const sequence =
        heads[channel] ??
        Math.max(
          this.#applied.get(channel) ?? 0,
          ...(this.#ahead.get(channel) ?? []),
        );

      this.#applied.set(channel, sequence);
      this.#settled.set(channel, sequence);
    }

    this.#ahead.clear();
    this.#settles = [];
  }

  watches(channel: string): boolean {
    return this.#applied.has(channel);
  }

  settle(upTo: Sequences, kept: ReadonlySet<string>): void {
    for (const [channel, sequence] of Object.entries(upTo)) {
      this.#settled.set(
        channel,
        Math.max(this.#settled.get(channel) ?? 0, sequence),
      );
    }

    this.#settles = [...this.#settles, { upTo, kept }].slice(-SETTLES_KEPT);

    for (const waiter of this.#waiters) {
      if (covers(upTo, waiter.positions)) {
        waiter.done(kept);
      }
    }
  }

  settledAt(
    positions: readonly Position[],
    waitMs: number,
  ): Promise<ReadonlySet<string> | null> {
    if (covers(this.settled(), positions)) {
      return Promise.resolve(
        this.#settles.find((settle) => covers(settle.upTo, positions))?.kept ??
          null,
      );
    }

    return new Promise((resolve) => {
      const waiter: Waiter = {
        positions,
        done: (kept) => {
          clearTimeout(timeout);
          this.#waiters.delete(waiter);
          resolve(kept);
        },
      };
      const timeout = setTimeout(() => waiter.done(null), waitMs);
      this.#waiters.add(waiter);
    });
  }

  #absorbed(channel: string): void {
    const ahead = this.#ahead.get(channel);
    let applied = this.#applied.get(channel) ?? 0;

    if (!ahead) {
      return;
    }

    for (const sequence of ahead) {
      if (sequence <= applied) {
        ahead.delete(sequence);
      }
    }

    while (ahead.has(applied + 1)) {
      applied += 1;
      ahead.delete(applied);
    }

    this.#applied.set(channel, applied);

    if (ahead.size === 0) {
      this.#ahead.delete(channel);
    }
  }
}

export const liveSequences = new LiveSequences();
