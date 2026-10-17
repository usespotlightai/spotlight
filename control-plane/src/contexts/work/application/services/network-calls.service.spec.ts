import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { NetworkCalls } from '@work/application/services/network-calls.service';
import type { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { UnknownNetworkCallError } from '@work/domain/exceptions/unknown-network-call.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
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
  answer = NetworkAnswer.of({
    status: 200,
    body: new TextEncoder().encode('{"refuse":"not today"}'),
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
        stored = stored.claimedBy(HOST, now).answerWith(HOST, answer, now);
      }
      return stored;
    },
    save: async (call: NetworkCall) => {
      saves += 1;
      stored = call.isDiscarded ? null : call;
    },
    lapsingBy: async (at: Date) =>
      stored && stored.lapsesAt <= at && !stored.settled ? [stored] : [],
    settledBy: async (at: Date) =>
      stored?.settledAt && stored.settledAt <= at ? [stored] : [],
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

  it('waits for the answer, reading the call every quarter second', async () => {
    const { calls, reads } = calling(1_000);
    await calls.queue('ws_1', REQUEST, later(15_000));

    const state = await calls.answered('call_1', later(10_000));

    expect(state).toEqual({
      kind: 'answered',
      answer: {
        status: 200,
        headers: {},
        body: new TextEncoder().encode('{"refuse":"not today"}'),
        ms: 84,
        error: null,
      },
    });
    expect(reads).toHaveLength(5);
    expect(reads[1]).toEqual(later(250));
  });

  it('gives the call up at the time it was given, forgetting what it would have sent', async () => {
    const { calls, stored } = calling();
    await calls.queue('ws_1', REQUEST, later(15_000));

    expect(await calls.answered('call_1', later(1_000))).toEqual({
      kind: 'lapsed',
    });
    expect(stored()?.progress).toEqual({
      kind: 'given-up',
      at: later(1_000),
    });
    expect(stored()?.request.headers).toEqual({});
    expect(stored()?.request.body.byteLength).toBe(0);
  });

  it('lapses the calls whose time is up, one at a time', async () => {
    const watching = calling();
    const { calls, stored, clock } = watching;
    await calls.queue('ws_1', REQUEST, later(1_000));
    await clock.sleep(1_000);

    expect(await calls.lapseOverdue()).toBe(1);
    expect(await calls.lapseOverdue()).toBe(0);
    expect(watching.saves).toBe(1);
    expect(stored()?.progress.kind).toBe('lapsed');
    expect(stored()?.request.headers).toEqual({});
  });

  it('says a call lapsed once its time is up unanswered', async () => {
    const { calls } = calling();
    await calls.queue('ws_1', REQUEST, later(2_000));

    expect(await calls.answered('call_1', later(10_000))).toEqual({
      kind: 'lapsed',
    });
  });

  it('forgets what a lapsed call would have sent once it sees it lapse', async () => {
    const { calls, stored } = calling();
    await calls.queue('ws_1', REQUEST, later(2_000));

    await calls.answered('call_1', later(10_000));

    expect(stored()?.progress.kind).toBe('lapsed');
    expect(stored()?.request.headers).toEqual({});
    expect(stored()?.request.body.byteLength).toBe(0);
  });

  it('only reads a call when asked how it stands, even once its time is up', async () => {
    const watching = calling();
    const { calls, clock } = watching;
    await calls.queue('ws_1', REQUEST, later(1_000));
    await clock.sleep(2_000);

    expect(await calls.stateOf('call_1')).toEqual({ kind: 'lapsed' });
    expect(watching.saves).toBe(0);
  });

  it('forgets calls settled more than a week ago', async () => {
    const watching = calling();
    const { calls, clock, stored } = watching;
    await calls.queue('ws_1', REQUEST, later(15_000));
    await calls.answered('call_1', later(1_000));

    await clock.sleep(7 * 24 * 60 * 60_000 - 1);
    expect(await calls.forgetSettled()).toBe(0);

    await clock.sleep(1);
    expect(await calls.forgetSettled()).toBe(1);
    expect(stored()).toBeNull();
  });

  it('knows no call it never queued', async () => {
    const { calls } = calling();

    await expect(calls.stateOf('call_9')).rejects.toThrow(
      UnknownNetworkCallError,
    );
  });
});
