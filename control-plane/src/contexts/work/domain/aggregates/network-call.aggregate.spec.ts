import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';
import { InvalidNetworkCallTransitionError } from '@work/domain/exceptions/invalid-network-call-transition.error';
import { NotThisHostsCallError } from '@work/domain/exceptions/not-this-hosts-call.error';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
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

const OK = NetworkResponse.of({
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
    expiresAt: later(15_000),
    now: NOW,
  });

describe('NetworkCall', () => {
  it('waits for a host once queued', () => {
    const call = queued();

    expect(call.stateAt(NOW)).toBe('waiting');
    expect(call.queuedAt).toEqual(NOW);
    expect(call.response).toBeNull();
  });

  it('must leave a host time to send it', () => {
    expect(() =>
      NetworkCall.queue({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: REQUEST,
        expiresAt: NOW,
        now: NOW,
      }),
    ).toThrow(InvalidNetworkCallError);
  });

  it('expires once its time is up unanswered', () => {
    expect(queued().stateAt(later(15_000))).toBe('expired');
    expect(queued().claimedBy(HOST, later(1_000)).stateAt(later(15_000))).toBe(
      'expired',
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

  it('is never claimed once expired', () => {
    expect(() => queued().claimedBy(HOST, later(15_000))).toThrow(
      'Network call call_1 is expired. It cannot be claimed.',
    );
  });

  it('keeps the response the host sent', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .recordResponse(HOST, OK, later(2_000));

    expect(answered.stateAt(later(60_000))).toBe('answered');
    expect(answered.response).toBe(OK);
    expect(answered.progress).toMatchObject({
      kind: 'answered',
      by: HOST,
      claimedAt: later(1_000),
      at: later(2_000),
    });
  });

  it('gets a response once', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .recordResponse(HOST, OK, later(2_000));

    expect(() => answered.recordResponse(HOST, OK, later(3_000))).toThrow(
      'Network call call_1 was already answered.',
    );
  });

  it('takes no response once expired', () => {
    expect(() =>
      queued()
        .claimedBy(HOST, later(1_000))
        .recordResponse(HOST, OK, later(15_000)),
    ).toThrow('Network call call_1 expired before it was answered.');
  });

  it('takes no response before a host claims it', () => {
    expect(() => queued().recordResponse(HOST, OK, later(1_000))).toThrow(
      'Network call call_1 is not claimed by a host yet.',
    );
  });

  it('takes a response only from the host that claimed it', () => {
    expect(() =>
      queued()
        .claimedBy(HOST, later(1_000))
        .recordResponse(CallingHost.of('host_2'), OK, later(2_000)),
    ).toThrow(NotThisHostsCallError);
  });

  it('discards what it sent once answered, keeping where it went', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .recordResponse(HOST, OK, later(2_000));

    expect(answered.request.headers).toEqual({});
    expect(answered.request.body.byteLength).toBe(0);
    expect(answered.request.method).toBe('POST');
    expect(answered.request.url).toBe('http://audit.internal:8080/hooks');
  });

  it('discards what it would have sent once it expires, and is never claimed again', () => {
    const expired = queued().expire(later(15_000));

    expect(expired.progress).toEqual({ kind: 'expired', at: later(15_000) });
    expect(expired.request.headers).toEqual({});
    expect(expired.request.body.byteLength).toBe(0);
    expect(expired.stateAt(later(15_000))).toBe('expired');
    expect(() => expired.claimedBy(HOST, later(15_000))).toThrow(
      InvalidNetworkCallTransitionError,
    );
  });

  it('is cancelled by whoever waited for it, discarding what it would have sent', () => {
    const cancelled = queued()
      .claimedBy(HOST, later(1_000))
      .cancel(later(5_000));

    expect(cancelled.progress).toEqual({ kind: 'cancelled', at: later(5_000) });
    expect(cancelled.stateAt(later(60_000))).toBe('cancelled');
    expect(cancelled.request.headers).toEqual({});
    expect(() => cancelled.recordResponse(HOST, OK, later(6_000))).toThrow(
      'Network call call_1 was cancelled. The hook stopped waiting for it.',
    );
    expect(() => queued().cancel(later(1)).claimedBy(HOST, later(2))).toThrow(
      'Network call call_1 was cancelled. The hook stopped waiting for it.',
    );
  });

  it('is stored a week after it completes, then purged', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .recordResponse(HOST, OK, later(2_000));
    const week = 7 * 24 * 60 * 60_000;

    expect(answered.isPastRetention(later(2_000 + week - 1))).toBe(false);
    expect(() => answered.purge(later(2_000 + week - 1))).toThrow(
      InvalidNetworkCallTransitionError,
    );
    expect(answered.purge(later(2_000 + week)).isDiscarded).toBe(true);
    expect(NetworkCall.retentionCutoff(later(week))).toEqual(NOW);
  });

  it('is never purged while it waits', () => {
    expect(queued().isPastRetention(later(30 * 24 * 60 * 60_000))).toBe(false);
  });

  it('stays answered when cancelled after its response came', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .recordResponse(HOST, OK, later(2_000));

    expect(answered.cancel(later(3_000))).toBe(answered);
  });

  it('cannot expire before its time is up', () => {
    expect(() => queued().expire(later(14_999))).toThrow(
      InvalidNetworkCallTransitionError,
    );
  });

  it('stays answered once it gets a response, however late the expiry comes', () => {
    const answered = queued()
      .claimedBy(HOST, later(1_000))
      .recordResponse(HOST, OK, later(2_000));

    expect(answered.expire(later(60_000))).toBe(answered);
  });

  it('will not be read back completed while it still has what it sent', () => {
    expect(() =>
      NetworkCall.rehydrate({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: REQUEST,
        queuedAt: NOW,
        expiresAt: later(15_000),
        progress: { kind: 'expired', at: later(15_000) },
        version: 1,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('belongs to the workspace that queued it', () => {
    expect(queued().belongsTo(WorkspaceId.of('ws_1'))).toBe(true);
    expect(queued().belongsTo(WorkspaceId.of('ws_2'))).toBe(false);
  });

  it('will not be read back expiring before it was queued', () => {
    expect(() =>
      NetworkCall.rehydrate({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: REQUEST,
        queuedAt: NOW,
        expiresAt: later(-1),
        progress: { kind: 'waiting' },
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});

describe('NetworkRequest', () => {
  const requesting = (over: Partial<Parameters<typeof NetworkRequest.of>[0]>) =>
    NetworkRequest.of({
      method: 'post',
      url: 'https://audit.acme.dev/hooks',
      headers: {},
      body: new Uint8Array(),
      timeoutMs: 1_000,
      ...over,
    });

  it('sends with the method named, in capitals', () => {
    expect(requesting({}).method).toBe('POST');
  });

  it('is sent over http or https only', () => {
    expect(() => requesting({ url: 'file:///etc/passwd' })).toThrow(
      InvalidNetworkCallError,
    );
    expect(() => requesting({ url: 'not a url' })).toThrow(
      InvalidNetworkCallError,
    );
  });

  it('waits a sensible while for its response', () => {
    expect(() => requesting({ timeoutMs: 0 })).toThrow(InvalidNetworkCallError);
    expect(() => requesting({ timeoutMs: 60_001 })).toThrow(
      InvalidNetworkCallError,
    );
  });
});

describe('NetworkAnswer', () => {
  it('keeps at most 16 KiB of what came back', () => {
    const response = NetworkResponse.of({
      status: 200,
      body: new Uint8Array(20_000),
      ms: 5,
    });

    expect(response.body.byteLength).toBe(16 * 1024);
  });

  it('says why nothing answered', () => {
    expect(() => NetworkResponse.of({ status: 0, ms: 5 })).toThrow(
      InvalidNetworkCallError,
    );
    expect(
      NetworkResponse.of({ status: 0, ms: 5, error: 'connection refused' })
        .error,
    ).toBe('connection refused');
  });

  it('is answered with an HTTP status in whole milliseconds', () => {
    expect(() => NetworkResponse.of({ status: 700, ms: 5 })).toThrow(
      InvalidNetworkCallError,
    );
    expect(() => NetworkResponse.of({ status: 200, ms: -1 })).toThrow(
      InvalidNetworkCallError,
    );
  });
});
