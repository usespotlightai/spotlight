import type {
  HostCredential,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AnswerHostCallHandler } from '@work/application/commands/handlers/answer-host-call.handler';
import { ClaimHostCallHandler } from '@work/application/commands/handlers/claim-host-call.handler';
import {
  AnswerHostCallCommand,
  ClaimHostCallCommand,
  type SentHostCallAnswer,
} from '@work/application/commands/host-call.commands';
import { LongPoll } from '@work/application/services/long-poll';
import { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { NetworkCallMovedOnError } from '@work/domain/exceptions/network-call-moved-on.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDE';
const POOL = { bearer: 'pool-token', trust: undefined };

const queued = (workspace = 'ws_1') =>
  NetworkCall.queue({
    id: NetworkCallId.of('call_1'),
    workspaceId: WorkspaceId.of(workspace),
    request: NetworkRequest.of({
      method: 'POST',
      url: 'http://audit.internal:8080/hooks',
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode('{"hook":"core/audit"}'),
      timeoutMs: 10_000,
    }),
    lapsesAt: later(15_000),
    now: NOW,
  });

const claimedCall = (workspace = 'ws_1') =>
  queued(workspace).claimedBy(CallingHost.of(HOST), NOW);

const hosting = (
  over: {
    next?: NetworkCall | null;
    found?: NetworkCall | null;
    clash?: boolean;
    reported?: boolean;
  } = {},
) => {
  let now = NOW;
  const clock: ClockPort = {
    now: () => now,
    sleep: async (ms) => {
      now = new Date(now.getTime() + ms);
    },
  };
  const admissions: RunnerAdmissionsPort = {
    admit: vi.fn(async (credential: HostCredential) =>
      credential.bearer === 'pool-token'
        ? {
            way: { kind: 'pool' as const, id: 'pool_1' },
            workspaceId: WorkspaceId.of('ws_1'),
          }
        : null,
    ),
  };
  const saved: NetworkCall[] = [];
  const runners = {
    reports: vi.fn(async () => over.reported ?? true),
  } as unknown as RunnersPort;
  const calls = {
    claimNext: vi.fn(async () => over.next ?? null),
    find: vi.fn(async () =>
      over.found === undefined ? claimedCall() : over.found,
    ),
    save: vi.fn(async (call: NetworkCall) => {
      if (over.clash) {
        throw new NetworkCallMovedOnError(call.id.value);
      }
      saved.push(call);
    }),
  };

  return {
    calls,
    saved,
    runners,
    claim: new ClaimHostCallHandler(
      admissions,
      runners,
      calls as unknown as NetworkCallRepository,
      clock,
      new LongPoll(clock),
    ),
    answer: new AnswerHostCallHandler(
      admissions,
      calls as unknown as NetworkCallRepository,
      clock,
    ),
  };
};

const ANSWER: SentHostCallAnswer = {
  host: HOST,
  status: 200,
  headers: { 'content-type': 'application/json', ignored: 7 },
  body: Buffer.from('{"refuse":"not today"}').toString('base64'),
  ms: 84,
  error: undefined,
};

describe('ClaimHostCallHandler', () => {
  it('refuses a host no pool or trust admits', async () => {
    const { claim, calls } = hosting();

    expect(
      await claim.execute(
        new ClaimHostCallCommand({ bearer: 'stolen', trust: undefined }, HOST),
      ),
    ).toEqual({ outcome: 'refused' });
    expect(calls.claimNext).not.toHaveBeenCalled();
  });

  it('hands over the next call waiting for the admitted workspace, body in base64', async () => {
    const { claim, calls } = hosting({ next: claimedCall() });

    expect(await claim.execute(new ClaimHostCallCommand(POOL, HOST))).toEqual({
      outcome: 'claimed',
      call: {
        id: 'call_1',
        method: 'POST',
        url: 'http://audit.internal:8080/hooks',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{"hook":"core/audit"}').toString('base64'),
        timeoutMs: 10_000,
      },
    });
    expect(calls.claimNext).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      CallingHost.of(HOST),
      NOW,
    );
  });

  it('answers a host that never reported through this way in as a stranger', async () => {
    const { claim, calls, runners } = hosting({ reported: false });

    expect(await claim.execute(new ClaimHostCallCommand(POOL, HOST))).toEqual({
      outcome: 'stranger',
    });
    expect(runners.reports).toHaveBeenCalledWith(
      { kind: 'pool', id: 'pool_1' },
      HOST,
    );
    expect(calls.claimNext).not.toHaveBeenCalled();
  });

  it('waits out the poll, then has nothing to hand out', async () => {
    const { claim, calls } = hosting();

    expect(await claim.execute(new ClaimHostCallCommand(POOL, HOST))).toEqual({
      outcome: 'nothing',
    });
    expect(calls.claimNext.mock.calls.length).toBeGreaterThan(1);
    expect(calls.claimNext).toHaveBeenLastCalledWith(
      WorkspaceId.of('ws_1'),
      CallingHost.of(HOST),
      later(10_000),
    );
  });

  it('refuses a host that names itself nothing', async () => {
    const { claim } = hosting();

    await expect(
      claim.execute(new ClaimHostCallCommand(POOL, '')),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
  });
});

describe('AnswerHostCallHandler', () => {
  it('keeps the answer the host sent', async () => {
    const { answer, saved } = hosting();

    expect(
      await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER)),
    ).toEqual({ outcome: 'answered' });

    const kept = saved[0]?.answer;
    expect(kept?.status).toBe(200);
    expect(kept?.headers).toEqual({ 'content-type': 'application/json' });
    expect(Buffer.from(kept?.body ?? []).toString()).toBe(
      '{"refuse":"not today"}',
    );
    expect(kept?.ms).toBe(84);
  });

  it('keeps why nothing answered', async () => {
    const { answer, saved } = hosting();

    await answer.execute(
      new AnswerHostCallCommand(POOL, 'call_1', {
        host: HOST,
        status: 0,
        headers: undefined,
        body: undefined,
        ms: 10_000,
        error: 'timed out after 10s',
      }),
    );

    expect(saved[0]?.answer?.error).toBe('timed out after 10s');
  });

  it('refuses a host no pool or trust admits', async () => {
    const { answer, calls } = hosting();

    expect(
      await answer.execute(
        new AnswerHostCallCommand(
          { bearer: 'stolen', trust: undefined },
          'call_1',
          ANSWER,
        ),
      ),
    ).toEqual({ outcome: 'refused' });
    expect(calls.find).not.toHaveBeenCalled();
  });

  it('refuses an answer from a host other than the one that claimed the call', async () => {
    const { answer, saved } = hosting();

    expect(
      await answer.execute(
        new AnswerHostCallCommand(POOL, 'call_1', {
          ...ANSWER,
          host: '01J8ZQ4Y7N3K5V2W9X6RTBHXXX',
        }),
      ),
    ).toEqual({ outcome: 'not-theirs' });
    expect(saved).toEqual([]);
  });

  it('forgets what the call sent once it keeps the answer', async () => {
    const { answer, saved } = hosting();

    await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER));

    expect(saved[0]?.request.headers).toEqual({});
    expect(saved[0]?.request.body.byteLength).toBe(0);
  });

  it('knows no call of another workspace', async () => {
    const { answer, saved } = hosting({ found: claimedCall('ws_2') });

    expect(
      await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER)),
    ).toEqual({ outcome: 'unknown' });
    expect(saved).toEqual([]);
  });

  it('knows no call that is not there', async () => {
    const { answer } = hosting({ found: null });

    expect(
      await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER)),
    ).toEqual({ outcome: 'unknown' });
  });

  it('says a call already answered is settled', async () => {
    const { answer } = hosting({
      found: claimedCall().answeredWith(
        CallingHost.of(HOST),
        NetworkAnswer.of({ status: 204, ms: 3 }),
        NOW,
      ),
    });

    expect(
      await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER)),
    ).toEqual({
      outcome: 'settled',
      reason: 'Network call call_1 was already answered.',
    });
  });

  it('says a call that was never claimed is settled no other way', async () => {
    const { answer } = hosting({ found: queued() });

    expect(
      await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER)),
    ).toMatchObject({ outcome: 'settled' });
  });

  it('refuses an answer that is no answer', async () => {
    const { answer } = hosting();

    await expect(
      answer.execute(
        new AnswerHostCallCommand(POOL, 'call_1', {
          ...ANSWER,
          status: 'teapot',
        }),
      ),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
  });

  it('says a call settled meanwhile is settled, not a fault', async () => {
    const { answer } = hosting({ clash: true });

    expect(
      await answer.execute(new AnswerHostCallCommand(POOL, 'call_1', ANSWER)),
    ).toEqual({
      outcome: 'settled',
      reason: 'The network call was settled while the host answered it.',
    });
  });
});
