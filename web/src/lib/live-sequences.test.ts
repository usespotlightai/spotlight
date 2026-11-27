import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveSequences, positionsIn, sinceQuery } from '@/lib/live-sequences';

const at = (sequence: number, channel = 'workspace:ws_1') => ({
  channel,
  sequence,
});

describe('positionsIn', () => {
  it('reads each channel and its sequence, and drops what it cannot read', () => {
    expect(
      positionsIn('workspace:ws_1@12, person:user_1@3,nonsense,x@0,y@-2,z@q'),
    ).toEqual([at(12), at(3, 'person:user_1')]);
  });

  it('reads nothing from no header', () => {
    expect(positionsIn(null)).toEqual([]);
  });
});

describe('sinceQuery', () => {
  it('gives one since for each channel', () => {
    expect(
      decodeURIComponent(
        sinceQuery({ 'workspace:ws_1': 4, 'person:user_1': 2 }),
      ),
    ).toBe('since=workspace:ws_1@4&since=person:user_1@2');
  });
});

describe('LiveSequences', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies the next sequence, and drops one it applied before', () => {
    const sequences = new LiveSequences();
    sequences.reset({ 'workspace:ws_1': 4 });

    expect(sequences.received(at(5))).toBe(true);
    expect(sequences.received(at(5))).toBe(false);
    expect(sequences.received(at(3))).toBe(false);
    expect(sequences.applied()).toEqual({ 'workspace:ws_1': 5 });
  });

  it('holds a sequence that came early until the gap closes', () => {
    const sequences = new LiveSequences();
    sequences.reset({ 'workspace:ws_1': 4 });

    expect(sequences.received(at(6))).toBe(true);
    expect(sequences.received(at(6))).toBe(false);
    expect(sequences.hasGap()).toBe(true);
    expect(sequences.applied()).toEqual({ 'workspace:ws_1': 4 });

    sequences.received(at(5));

    expect(sequences.hasGap()).toBe(false);
    expect(sequences.applied()).toEqual({ 'workspace:ws_1': 6 });
  });

  it('takes every change on a channel it has no sequence for, until the stream gives one', () => {
    const sequences = new LiveSequences();

    expect(sequences.received(at(9))).toBe(true);
    expect(sequences.received(at(8))).toBe(true);
    expect(sequences.applied()).toEqual({});
    expect(sequences.watches('workspace:ws_1')).toBe(false);
    expect(sequences.hasGap()).toBe(false);
  });

  it('catches up to the heads the stream gives, and closes the gaps they cover', () => {
    const sequences = new LiveSequences();
    sequences.reset({ 'workspace:ws_1': 4 });
    sequences.received(at(7));

    sequences.caughtUp({ 'workspace:ws_1': 6, 'person:user_1': 2 });

    expect(sequences.applied()).toEqual({
      'workspace:ws_1': 7,
      'person:user_1': 2,
    });
    expect(sequences.hasGap()).toBe(false);
  });

  it('starts again from the heads after a stream that could not catch up, even when they went back', () => {
    const sequences = new LiveSequences();
    sequences.reset({ 'workspace:ws_1': 50, 'person:user_1': 2 });
    sequences.received(at(4, 'person:user_1'));

    sequences.restarted({ 'workspace:ws_1': 3 });

    expect(sequences.applied()).toEqual({
      'workspace:ws_1': 3,
      'person:user_1': 4,
    });
    expect(sequences.settled()).toEqual(sequences.applied());
    expect(sequences.hasGap()).toBe(false);
    expect(sequences.received(at(4))).toBe(true);
  });

  it('tells a waiting write when its sequences are refreshed, with the queries that refresh kept', async () => {
    const sequences = new LiveSequences();
    const waiting = sequences.settledAt([at(5)], 1_000);
    const kept = new Set(['["inbox"]']);

    sequences.settle({ 'workspace:ws_1': 4 }, new Set());
    sequences.settle({ 'workspace:ws_1': 5 }, kept);

    expect(await waiting).toBe(kept);
    expect(await sequences.settledAt([at(5)], 1_000)).toBe(kept);
  });

  it('gives up on a write whose sequences are not refreshed in time', async () => {
    const sequences = new LiveSequences();
    const waiting = sequences.settledAt([at(5)], 1_000);

    vi.advanceTimersByTime(1_000);

    expect(await waiting).toBeNull();
  });
});
