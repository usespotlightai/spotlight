import { createHash } from 'node:crypto';
import type {
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { CallSecretFetch } from '@secrets/application/ports/call-secret-fetches.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ClaimHostCallHandler } from '@work/application/commands/handlers/claim-host-call.handler';
import { RecordHostCallResponseHandler } from '@work/application/commands/handlers/record-host-call-response.handler';
import { RedeemCallSecretsHandler } from '@work/application/commands/handlers/redeem-call-secrets.handler';
import {
  ClaimHostCallCommand,
  RecordHostCallResponseCommand,
  RedeemCallSecretsCommand,
  type SentHostCallResponse,
} from '@work/application/commands/host-call.commands';
import { LongPoll } from '@work/application/services/long-poll';
import { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { NetworkCallVersionConflictError } from '@work/domain/exceptions/network-call-version-conflict.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDE';
const POOL = { bearer: 'pool-token', trust: undefined };

const queued = (workspace = 'ws_1', secrets: readonly string[] = []) =>
  NetworkCall.queue({
    id: NetworkCallId.of('call_1'),
    workspaceId: WorkspaceId.of(workspace),
    secrets: secrets.map((each) => SecretName.of(each)),
    request: NetworkRequest.of({
      method: 'POST',
      url: 'http://audit.internal:8080/hooks',
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode('{"hook":"core/audit"}'),
      timeoutMs: 10_000,
    }),
    expiresAt: later(15_000),
    now: NOW,
  });

const SECRETS_TOKEN_HASH = TokenHash.of(
  createHash('sha256').update('secrets-token').digest('hex'),
);

const claimedCall = (workspace = 'ws_1', secrets: readonly string[] = []) =>
  queued(workspace, secrets).claimedBy(
    CallingHost.of(HOST),
    NOW,
    SECRETS_TOKEN_HASH,
  );

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
  const authenticator: RunnerAuthenticatorPort = {
    authenticate: vi.fn(async (credential: HostCredentials) =>
      credential.bearer === 'pool-token'
        ? {
            source: { kind: 'pool' as const, id: 'pool_1' },
            workspaceId: WorkspaceId.of('ws_1'),
          }
        : null,
    ),
  };
  const saved: NetworkCall[] = [];
  const tokens = issuing();
  const fetches = {
    sealedForCall: vi.fn(async (request: CallSecretFetch) => ({
      secrets: request.secrets.map((secret) => ({
        secret,
        host: 'slack.com',
        location: 'header',
        name: 'authorization',
        prefix: 'Bearer ',
        sealed: `v1.sealed-for-${request.callId}`,
        externalRef: null,
      })),
      denied: [],
    })),
  };
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
        throw new NetworkCallVersionConflictError(call.id.value);
      }
      saved.push(call);
    }),
  };

  return {
    calls,
    saved,
    runners,
    claim: new ClaimHostCallHandler(
      authenticator,
      runners,
      calls as unknown as NetworkCallRepository,
      clock,
      new LongPoll(clock),
      tokens,
    ),
    response: new RecordHostCallResponseHandler(
      authenticator,
      calls as unknown as NetworkCallRepository,
      clock,
    ),
    fetches,
    redeem: new RedeemCallSecretsHandler(
      calls as unknown as NetworkCallRepository,
      fetches,
      tokens,
      clock,
    ),
  };
};

const hashOf = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const issuing = (): TokenIssuer => ({
  issue: () => ({ token: 'secrets-token', hash: hashOf('secrets-token') }),
  hash: hashOf,
});

const RESPONSE: SentHostCallResponse = {
  host: HOST,
  status: 200,
  headers: { 'content-type': 'application/json', ignored: 7 },
  body: Buffer.from('{"deny":"not today"}').toString('base64'),
  ms: 84,
  error: undefined,
};

describe('ClaimHostCallHandler', () => {
  it('rejects a host that no pool or trust accepts', async () => {
    const { claim, calls } = hosting();

    expect(
      await claim.execute(
        new ClaimHostCallCommand({ bearer: 'stolen', trust: undefined }, HOST),
      ),
    ).toEqual({ outcome: 'unauthorized' });
    expect(calls.claimNext).not.toHaveBeenCalled();
  });

  it('hands over the next call waiting for the authenticated workspace, body in base64', async () => {
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
        secretsToken: null,
      },
    });
    expect(calls.claimNext).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      CallingHost.of(HOST),
      NOW,
      TokenHash.of(hashOf('secrets-token')),
    );
  });

  it('gives the host only the time left until the call expires, at least a second', async () => {
    const expiringIn = (ms: number) =>
      NetworkCall.queue({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        secrets: [],
        request: NetworkRequest.of({
          method: 'POST',
          url: 'http://audit.internal:8080/hooks',
          headers: {},
          body: new Uint8Array(),
          timeoutMs: 10_000,
        }),
        expiresAt: later(ms),
        now: later(-20_000),
      }).claimedBy(CallingHost.of(HOST), NOW);

    for (const [left, timeoutMs] of [
      [4_000, 4_000],
      [300, 1_000],
      [30_000, 10_000],
    ]) {
      expect(
        await hosting({ next: expiringIn(left as number) }).claim.execute(
          new ClaimHostCallCommand(POOL, HOST),
        ),
      ).toMatchObject({ outcome: 'claimed', call: { timeoutMs } });
    }
  });

  it('hands over a token to redeem the secrets of a call that names secrets', async () => {
    const { claim } = hosting({
      next: claimedCall('ws_1', ['SLACK_BOT_TOKEN']),
    });

    expect(
      await claim.execute(new ClaimHostCallCommand(POOL, HOST)),
    ).toMatchObject({
      outcome: 'claimed',
      call: { id: 'call_1', secretsToken: 'secrets-token' },
    });
  });

  it('answers a host that never reported through this pool or trust as host-unreported', async () => {
    const { claim, calls, runners } = hosting({ reported: false });

    expect(await claim.execute(new ClaimHostCallCommand(POOL, HOST))).toEqual({
      outcome: 'host-unreported',
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
      TokenHash.of(hashOf('secrets-token')),
    );
  });

  it('rejects a host that names itself nothing', async () => {
    const { claim } = hosting();

    await expect(
      claim.execute(new ClaimHostCallCommand(POOL, '')),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('AnswerHostCallHandler', () => {
  it('keeps the response the host sent', async () => {
    const { response, saved } = hosting();

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
      ),
    ).toEqual({ outcome: 'answered' });

    const stored = saved[0]?.response;
    expect(stored?.status).toBe(200);
    expect(stored?.headers).toEqual({ 'content-type': 'application/json' });
    expect(Buffer.from(stored?.body ?? []).toString()).toBe(
      '{"deny":"not today"}',
    );
    expect(stored?.ms).toBe(84);
  });

  it('keeps why nothing answered', async () => {
    const { response, saved } = hosting();

    await response.execute(
      new RecordHostCallResponseCommand(POOL, 'call_1', {
        host: HOST,
        status: 0,
        headers: undefined,
        body: undefined,
        ms: 10_000,
        error: 'timed out after 10s',
      }),
    );

    expect(saved[0]?.response?.error).toBe('timed out after 10s');
  });

  it('rejects a host that no pool or trust accepts', async () => {
    const { response, calls } = hosting();

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(
          { bearer: 'stolen', trust: undefined },
          'call_1',
          RESPONSE,
        ),
      ),
    ).toEqual({ outcome: 'unauthorized' });
    expect(calls.find).not.toHaveBeenCalled();
  });

  it('rejects a response from a host other than the one that claimed the call', async () => {
    const { response, saved } = hosting();

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', {
          ...RESPONSE,
          host: '01J8ZQ4Y7N3K5V2W9X6RTBHXXX',
        }),
      ),
    ).toEqual({ outcome: 'not-theirs' });
    expect(saved).toEqual([]);
  });

  it('discards what the call sent once it stores the response', async () => {
    const { response, saved } = hosting();

    await response.execute(
      new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
    );

    expect(saved[0]?.request.headers).toEqual({});
    expect(saved[0]?.request.body.byteLength).toBe(0);
  });

  it('knows no call of another workspace', async () => {
    const { response, saved } = hosting({ found: claimedCall('ws_2') });

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
      ),
    ).toEqual({ outcome: 'unknown' });
    expect(saved).toEqual([]);
  });

  it('knows no call that is not there', async () => {
    const { response } = hosting({ found: null });

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
      ),
    ).toEqual({ outcome: 'unknown' });
  });

  it('says a call already answered is completed', async () => {
    const { response } = hosting({
      found: claimedCall().recordResponse(
        CallingHost.of(HOST),
        NetworkResponse.of({ status: 204, ms: 3 }),
        NOW,
      ),
    });

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
      ),
    ).toEqual({
      outcome: 'completed',
      reason: 'Network call call_1 was already answered.',
    });
  });

  it('sets the completed outcome on a call that was never claimed', async () => {
    const { response } = hosting({ found: queued() });

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
      ),
    ).toMatchObject({ outcome: 'completed' });
  });

  it('rejects a response that is no response', async () => {
    const { response } = hosting();

    await expect(
      response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', {
          ...RESPONSE,
          status: 'teapot',
        }),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('says a call completed meanwhile is completed, not a fault', async () => {
    const { response } = hosting({ clash: true });

    expect(
      await response.execute(
        new RecordHostCallResponseCommand(POOL, 'call_1', RESPONSE),
      ),
    ).toEqual({
      outcome: 'completed',
      reason:
        'The network call completed while the host recorded its response.',
    });
  });
});

describe('RedeemCallSecretsHandler', () => {
  const RECIPIENT = Buffer.alloc(32, 7).toString('base64');

  const redeeming = (over: { host?: unknown; token?: unknown } = {}) =>
    new RedeemCallSecretsCommand(
      'call_1',
      over.host ?? HOST,
      over.token ?? 'secrets-token',
      RECIPIENT,
    );

  it('seals the secrets the call names to the recipient, bound to the call, once', async () => {
    const { redeem, fetches, saved } = hosting({
      found: claimedCall('ws_1', ['SLACK_BOT_TOKEN']),
    });

    expect(await redeem.execute(redeeming())).toEqual({
      outcome: 'fetched',
      runId: 'call_1',
      extraAllowedHosts: [],
      bound: ['slack.com'],
      secrets: [
        {
          secret: 'SLACK_BOT_TOKEN',
          host: 'slack.com',
          location: 'header',
          name: 'authorization',
          prefix: 'Bearer ',
          sealed: 'v1.sealed-for-call_1',
          externalRef: null,
        },
      ],
      denied: [],
      spotlightApi: null,
    });
    expect(fetches.sealedForCall).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      callId: 'call_1',
      secrets: ['SLACK_BOT_TOKEN'],
      recipient: RECIPIENT,
    });
    expect(saved[0]?.secretsClaim?.redeemedAt).toEqual(NOW);
  });

  it('refuses a call that is not there, or has no id it could have, as it refuses a wrong token', async () => {
    const { redeem } = hosting({ found: null });

    expect(await redeem.execute(redeeming())).toEqual({
      outcome: 'unauthorized',
    });
    expect(
      await redeem.execute(
        new RedeemCallSecretsCommand('../call', HOST, 'secrets-token', ''),
      ),
    ).toEqual({ outcome: 'unauthorized' });
  });

  it('seals nothing for another token, no token, or a host with no name', async () => {
    const { redeem, fetches, saved } = hosting({
      found: claimedCall('ws_1', ['SLACK_BOT_TOKEN']),
    });

    for (const command of [
      redeeming({ token: 'stolen' }),
      redeeming({ token: 7 }),
      redeeming({ host: '' }),
    ]) {
      expect(await redeem.execute(command)).toEqual({
        outcome: 'unauthorized',
      });
    }
    expect(fetches.sealedForCall).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it('seals nothing a second time, or for a host that did not claim the call', async () => {
    const redeemedOnce = claimedCall('ws_1', ['SLACK_BOT_TOKEN']).redeemSecrets(
      CallingHost.of(HOST),
      SECRETS_TOKEN_HASH,
      NOW,
    );

    expect(
      await hosting({ found: redeemedOnce }).redeem.execute(redeeming()),
    ).toMatchObject({ outcome: 'taken' });
    expect(
      await hosting({
        found: claimedCall('ws_1', ['SLACK_BOT_TOKEN']),
      }).redeem.execute(redeeming({ host: '01J8ZQ4Y7N3K5V2W9X6RTBHXXX' })),
    ).toMatchObject({ outcome: 'taken' });
  });

  it('seals nothing once the call expired', async () => {
    const { redeem, fetches } = hosting({
      found: NetworkCall.queue({
        id: NetworkCallId.of('call_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        request: claimedCall().request,
        secrets: [SecretName.of('SLACK_BOT_TOKEN')],
        expiresAt: later(-1),
        now: later(-20_000),
      }).claimedBy(CallingHost.of(HOST), later(-10_000), SECRETS_TOKEN_HASH),
    });

    expect(await redeem.execute(redeeming())).toMatchObject({
      outcome: 'expired',
    });
    expect(fetches.sealedForCall).not.toHaveBeenCalled();
  });

  it('hands over nothing sealed when the call was redeemed meanwhile', async () => {
    const { redeem } = hosting({
      found: claimedCall('ws_1', ['SLACK_BOT_TOKEN']),
      clash: true,
    });

    expect(await redeem.execute(redeeming())).toMatchObject({
      outcome: 'taken',
    });
  });
});
