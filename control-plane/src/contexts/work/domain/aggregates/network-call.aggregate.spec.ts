import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';
import { InvalidNetworkCallTransitionError } from '@work/domain/exceptions/invalid-network-call-transition.error';
import { NotThisHostsCallError } from '@work/domain/exceptions/not-this-hosts-call.error';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOST = CallingHost.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const REQUEST = NetworkRequest.of({
  method: 'POST',
  url: 'http://audit.internal:8080/hooks',
  headers: { 'content-type': 'application/json' },
  body: new TextEncoder().encode('{"hook":"core/audit"}'),
  timeoutMs: 10_000,
});

const OK = NetworkAnswer.of({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: new TextEncoder().encode('{"ok":true}'),
  ms: 84,
});

const queued = () =>
  NetworkCall.queue({
    id: NetworkCallId.of('call_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    request: REQUEST,
    lapsesAt: later(15_000),
    now: NOW,
  });

describe('NetworkCall', () => {
  it('waits for a host once queued', () => {
    const call = queued();

    expect(call.stateAt(NOW)).toBe('waiting');
    expect(call.queuedAt).toEqual(NOW);
    expect(call.answer).toBeNull();
  });

  it('must leave a host time to send it', () => {
    expect(() =>
      NetworkCall.queue({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: REQUEST,
        lapsesAt: NOW,
        now: NOW,
      }),
    ).toThrow(InvalidNetworkCallError);
  });

  it('lapses once its time is up unanswered', () => {
    expect(queued().stateAt(later(15_000))).toBe('lapsed');
    expect(queued().claimedBy(HOST, later(1_000)).stateAt(later(15_000))).toBe(
      'lapsed',
    );
  });

  it('is claimed by one host', () => {
    const claimed = queued().claimedBy(HOST, later(1_000));

    expect(claimed.progress).toEqual({
      kind: 'claimed',
      by: HOST,
      at: later(1_000),
    });
    expect(() => claimed.claimedBy(HOST, later(2_000))).toThrow(
      InvalidNetworkCallTransitionError,
    );
  });

  it('is never handed out once lapsed', () => {
    expect(() => queued().claimedBy(HOST, later(15_000))).toThrow(
      'Network call call_1 is lapsed. It cannot be claimed.',
    );
  });

  it('keeps the answer the host sent', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .answeredWith(HOST, OK, later(2_000));

    expect(answered.stateAt(later(60_000))).toBe('answered');
    expect(answered.answer).toBe(OK);
    expect(answered.progress).toMatchObject({
      kind: 'answered',
      by: HOST,
      claimedAt: later(1_000),
      at: later(2_000),
    });
  });

  it('is answered once', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .answeredWith(HOST, OK, later(2_000));

    expect(() => answered.answeredWith(HOST, OK, later(3_000))).toThrow(
      'Network call call_1 was already answered.',
    );
  });

  it('takes no answer once lapsed', () => {
    expect(() =>
      queued()
        .claimedBy(HOST, later(1_000))
        .answeredWith(HOST, OK, later(15_000)),
    ).toThrow('Network call call_1 lapsed before it was answered.');
  });

  it('takes no answer before a host claims it', () => {
    expect(() => queued().answeredWith(HOST, OK, later(1_000))).toThrow(
      'Network call call_1 is not claimed by a host yet.',
    );
  });

  it('takes an answer only from the host that claimed it', () => {
    expect(() =>
      queued()
        .claimedBy(HOST, later(1_000))
        .answeredWith(CallingHost.of('host_2'), OK, later(2_000)),
    ).toThrow(NotThisHostsCallError);
  });

  it('forgets what it sent once answered, keeping where it went', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .answeredWith(HOST, OK, later(2_000));

    expect(answered.request.headers).toEqual({});
    expect(answered.request.body.byteLength).toBe(0);
    expect(answered.request.method).toBe('POST');
    expect(answered.request.url).toBe('http://audit.internal:8080/hooks');
  });

  it('forgets what it would have sent once it lapses, and is never handed out again', () => {
    const lapsed = queued().lapsed(later(15_000));

    expect(lapsed.progress).toEqual({ kind: 'lapsed', at: later(15_000) });
    expect(lapsed.request.headers).toEqual({});
    expect(lapsed.request.body.byteLength).toBe(0);
    expect(lapsed.stateAt(later(15_000))).toBe('lapsed');
    expect(() => lapsed.claimedBy(HOST, later(15_000))).toThrow(
      InvalidNetworkCallTransitionError,
    );
  });

  it('is given up on by whoever waited for it, forgetting what it would have sent', () => {
    const given = queued().claimedBy(HOST, later(1_000)).givenUp(later(5_000));

    expect(given.progress).toEqual({ kind: 'given-up', at: later(5_000) });
    expect(given.stateAt(later(60_000))).toBe('given-up');
    expect(given.request.headers).toEqual({});
    expect(() => given.answeredWith(HOST, OK, later(6_000))).toThrow(
      'Network call call_1 was given up. The hook stopped waiting for it.',
    );
    expect(() => queued().givenUp(later(1)).claimedBy(HOST, later(2))).toThrow(
      'Network call call_1 was given up. The hook stopped waiting for it.',
    );
  });

  it('is kept a week after it settles, then forgotten', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .answeredWith(HOST, OK, later(2_000));
    const week = 7 * 24 * 60 * 60_000;

    expect(answered.isForgettableAt(later(2_000 + week - 1))).toBe(false);
    expect(() => answered.forgotten(later(2_000 + week - 1))).toThrow(
      InvalidNetworkCallTransitionError,
    );
    expect(answered.forgotten(later(2_000 + week)).isDiscarded).toBe(true);
    expect(NetworkCall.settledForgettablyBy(later(week))).toEqual(NOW);
  });

  it('is never forgotten while it waits', () => {
    expect(queued().isForgettableAt(later(30 * 24 * 60 * 60_000))).toBe(false);
  });

  it('stays answered when given up on after its answer came', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .answeredWith(HOST, OK, later(2_000));

    expect(answered.givenUp(later(3_000))).toBe(answered);
  });

  it('cannot lapse before its time is up', () => {
    expect(() => queued().lapsed(later(14_999))).toThrow(
      InvalidNetworkCallTransitionError,
    );
  });

  it('stays answered once answered, however late it is asked to lapse', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .answeredWith(HOST, OK, later(2_000));

    expect(answered.lapsed(later(60_000))).toBe(answered);
  });

  it('will not be read back settled while still holding what it sent', () => {
    expect(() =>
      NetworkCall.rehydrate({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: REQUEST,
        queuedAt: NOW,
        lapsesAt: later(15_000),
        progress: { kind: 'lapsed', at: later(15_000) },
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('belongs to the workspace that queued it', () => {
    expect(queued().belongsTo(WorkspaceId.of('ws_1'))).toBe(true);
    expect(queued().belongsTo(WorkspaceId.of('ws_2'))).toBe(false);
  });

  it('will not be read back lapsing before it was queued', () => {
    expect(() =>
      NetworkCall.rehydrate({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: REQUEST,
        queuedAt: NOW,
        lapsesAt: later(-1),
        progress: { kind: 'waiting' },
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('NetworkRequest', () => {
  const asking = (over: Partial<Parameters<typeof NetworkRequest.of>[0]>) =>
    NetworkRequest.of({
      method: 'post',
      url: 'https://audit.acme.dev/hooks',
      headers: {},
      body: new Uint8Array(),
      timeoutMs: 1_000,
      ...over,
    });

  it('sends with the method named, in capitals', () => {
    expect(asking({}).method).toBe('POST');
  });

  it('is sent over http or https only', () => {
    expect(() => asking({ url: 'file:///etc/passwd' })).toThrow(
      InvalidNetworkCallError,
    );
    expect(() => asking({ url: 'not a url' })).toThrow(InvalidNetworkCallError);
  });

  it('waits a sensible while for its answer', () => {
    expect(() => asking({ timeoutMs: 0 })).toThrow(InvalidNetworkCallError);
    expect(() => asking({ timeoutMs: 60_001 })).toThrow(
      InvalidNetworkCallError,
    );
  });
});

describe('NetworkAnswer', () => {
  it('keeps at most 16 KiB of what came back', () => {
    const answer = NetworkAnswer.of({
      status: 200,
      body: new Uint8Array(20_000),
      ms: 5,
    });

    expect(answer.body.byteLength).toBe(16 * 1024);
  });

  it('says why nothing answered', () => {
    expect(() => NetworkAnswer.of({ status: 0, ms: 5 })).toThrow(
      InvalidNetworkCallError,
    );
    expect(
      NetworkAnswer.of({ status: 0, ms: 5, error: 'connection refused' }).error,
    ).toBe('connection refused');
  });

  it('is answered with an HTTP status in whole milliseconds', () => {
    expect(() => NetworkAnswer.of({ status: 700, ms: 5 })).toThrow(
      InvalidNetworkCallError,
    );
    expect(() => NetworkAnswer.of({ status: 200, ms: -1 })).toThrow(
      InvalidNetworkCallError,
    );
  });
});
