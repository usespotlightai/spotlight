import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { NetworkCalls } from '@work/application/services/network-calls.service';
import type { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { UnknownNetworkCallError } from '@work/domain/exceptions/unknown-network-call.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOST = CallingHost.of('host_1');

const REQUEST = {
  method: 'POST',
  url: 'http://audit.internal:8080/hooks',
  headers: { 'content-type': 'application/json' },
  body: new TextEncoder().encode('{}'),
  timeoutMs: 10_000,
};

const calling = (
  answerAfter: number | null = null,
  response = NetworkResponse.of({
    status: 200,
    body: new TextEncoder().encode('{"deny":"not today"}'),
    ms: 84,
  }),
) => {
  let now = NOW;
  const clock: ClockPort = {
    now: () => now,
    sleep: async (ms) => {
      now = new Date(now.getTime() + ms);
    },
  };
  let stored: NetworkCall | null = null;
  const reads: Date[] = [];
  let saves = 0;
  const repository = {
    add: async (call: NetworkCall) => {
      stored = call;
    },
    find: async () => {
      reads.push(now);
      if (
        stored &&
        answerAfter !== null &&
        now.getTime() - NOW.getTime() >= answerAfter &&
        stored.stateAt(now) === 'waiting'
      ) {
        stored = stored
          .claimedBy(HOST, now)
          .recordResponse(HOST, response, now);
      }
      return stored;
    },
    save: async (call: NetworkCall) => {
      saves += 1;
      stored = call.isDiscarded ? null : call;
    },
    expiringBy: async (at: Date) =>
      stored && stored.expiresAt <= at && !stored.isCompleted ? [stored] : [],
    completedBy: async (at: Date) =>
      stored?.completedAt && stored.completedAt <= at ? [stored] : [],
  } as unknown as NetworkCallRepository;

  return {
    reads,
    clock,
    stored: () => stored,
    get saves() {
      return saves;
    },
    calls: new NetworkCalls(repository, { generate: () => 'call_1' }, clock),
  };
};

describe('NetworkCalls', () => {
  it('queues a call for the workspace’s hosts', async () => {
    const { calls, stored } = calling();

    expect(await calls.queue('ws_1', REQUEST, later(15_000))).toBe('call_1');
    expect(stored()?.workspaceId.value).toBe('ws_1');
    expect(stored()?.request.url).toBe('http://audit.internal:8080/hooks');
    expect(await calls.stateOf('call_1')).toEqual({ kind: 'waiting' });
  });

  it('waits for the response, reading the call every quarter second', async () => {
    const { calls, reads } = calling(1_000);
    await calls.queue('ws_1', REQUEST, later(15_000));

    const state = await calls.answered('call_1', later(10_000));

    expect(state).toEqual({
      kind: 'answered',
      response: {
        status: 200,
        headers: {},
        body: new TextEncoder().encode('{"deny":"not today"}'),
        ms: 84,
        error: null,
      },
    });
    expect(reads).toHaveLength(5);
    expect(reads[1]).toEqual(later(250));
  });

  it('cancels the call at the time it was given, discarding what it would have sent', async () => {
    const { calls, stored } = calling();
    await calls.queue('ws_1', REQUEST, later(15_000));

    expect(await calls.answered('call_1', later(1_000))).toEqual({
      kind: 'expired',
    });
    expect(stored()?.progress).toEqual({
      kind: 'cancelled',
      at: later(1_000),
    });
    expect(stored()?.request.headers).toEqual({});
    expect(stored()?.request.body.byteLength).toBe(0);
  });

  it('expires the calls whose time is up, one at a time', async () => {
    const watching = calling();
    const { calls, stored, clock } = watching;
    await calls.queue('ws_1', REQUEST, later(1_000));
    await clock.sleep(1_000);

    expect(await calls.expireDue()).toBe(1);
    expect(await calls.expireDue()).toBe(0);
    expect(watching.saves).toBe(1);
    expect(stored()?.progress.kind).toBe('expired');
    expect(stored()?.request.headers).toEqual({});
  });

  it('says a call expired once its time is up unanswered', async () => {
    const { calls } = calling();
    await calls.queue('ws_1', REQUEST, later(2_000));

    expect(await calls.answered('call_1', later(10_000))).toEqual({
      kind: 'expired',
    });
  });

  it('discards what an expired call would have sent once it sees it expire', async () => {
    const { calls, stored } = calling();
    await calls.queue('ws_1', REQUEST, later(2_000));

    await calls.answered('call_1', later(10_000));

    expect(stored()?.progress.kind).toBe('expired');
    expect(stored()?.request.headers).toEqual({});
    expect(stored()?.request.body.byteLength).toBe(0);
  });

  it('only reads a call when requested for its state, even once its time is up', async () => {
    const watching = calling();
    const { calls, clock } = watching;
    await calls.queue('ws_1', REQUEST, later(1_000));
    await clock.sleep(2_000);

    expect(await calls.stateOf('call_1')).toEqual({ kind: 'expired' });
    expect(watching.saves).toBe(0);
  });

  it('purges calls completed more than a week ago', async () => {
    const watching = calling();
    const { calls, clock, stored } = watching;
    await calls.queue('ws_1', REQUEST, later(15_000));
    await calls.answered('call_1', later(1_000));

    await clock.sleep(7 * 24 * 60 * 60_000 - 1);
    expect(await calls.purgeCompleted()).toBe(0);

    await clock.sleep(1);
    expect(await calls.purgeCompleted()).toBe(1);
    expect(stored()).toBeNull();
  });

  it('knows no call it never queued', async () => {
    const { calls } = calling();

    await expect(calls.stateOf('call_9')).rejects.toThrow(
      UnknownNetworkCallError,
    );
  });
});
