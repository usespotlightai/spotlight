import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NetworkCalls } from '@work/application/services/network-calls.service';
import { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { NetworkCallVersionConflictError } from '@work/domain/exceptions/network-call-version-conflict.error';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
import { DrizzleNetworkCallRepository } from '@work/infrastructure/persistence/drizzle/repositories/network-call.repository';
import { networkCall } from '@work/infrastructure/persistence/drizzle/schemas/network-call.schema';
import { pushSchema } from 'drizzle-kit/api';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const HOST = CallingHost.of('host_1');
const TOKEN = TokenHash.of('a'.repeat(64));

let database: TestDatabase;
let calls: DrizzleNetworkCallRepository;
let ids = 0;

const queued = async (
  over: { workspace?: string; at?: Date; expiresAt?: Date } = {},
): Promise<NetworkCall> => {
  const at = over.at ?? NOW;
  const call = NetworkCall.queue({
    id: NetworkCallId.of(`call_${++ids}`),
    workspaceId: WorkspaceId.of(over.workspace ?? 'ws_1'),
    request: NetworkRequest.of({
      method: 'POST',
      url: 'http://audit.internal:8080/hooks',
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode(`{"call":${ids}}`),
      timeoutMs: 10_000,
    }),
    expiresAt: over.expiresAt ?? new Date(at.getTime() + 15_000),
    now: at,
  });

  await calls.add(call);

  return call;
};

beforeAll(async () => {
  database = await openDatabase('network_calls');
  const pushed = await pushSchema({ networkCall }, database.db, undefined, [
    'network_call',
  ]);

  for (const statement of pushed.statementsToExecute) {
    if (statement.includes('"network_call"')) {
      await database.db.execute(sql.raw(statement));
    }
  }

  calls = new DrizzleNetworkCallRepository(new DrizzleContext(database.db), {
    dispatch: async () => {},
  });
});

afterAll(async () => {
  await database?.close();
});

beforeEach(async () => {
  await database.db.delete(networkCall);
});

describe('DrizzleNetworkCallRepository', () => {
  it('reads back a call as it was queued', async () => {
    const call = await queued();

    const found = await calls.find(call.id);

    expect(found?.request.method).toBe('POST');
    expect(found?.request.headers).toEqual({
      'content-type': 'application/json',
    });
    expect(new TextDecoder().decode(found?.request.body)).toBe(
      `{"call":${ids}}`,
    );
    expect(found?.stateAt(NOW)).toBe('waiting');
    expect(found?.expiresAt).toEqual(call.expiresAt);
  });

  it('hands the oldest waiting call of the workspace to a host', async () => {
    await queued({ workspace: 'ws_2', at: later(-5_000) });
    const oldest = await queued({ at: later(-2_000) });
    await queued({ at: later(-1_000) });

    const claimed = await calls.claimNext(
      WorkspaceId.of('ws_1'),
      HOST,
      NOW,
      TOKEN,
    );

    expect(claimed?.id).toEqual(oldest.id);
    expect((await calls.find(oldest.id))?.progress).toEqual({
      kind: 'claimed',
      by: HOST,
      at: NOW,
    });
  });

  it('never hands out a call that expired', async () => {
    await queued({ at: later(-20_000), expiresAt: later(-1) });

    expect(
      await calls.claimNext(WorkspaceId.of('ws_1'), HOST, NOW, TOKEN),
    ).toBeNull();
  });

  it('hands each call to one host only, however many request at once', async () => {
    for (let each = 0; each < 3; each++) {
      await queued({ at: later(-each) });
    }

    const claimed = await Promise.all(
      Array.from({ length: 8 }, (_, each) =>
        calls.claimNext(
          WorkspaceId.of('ws_1'),
          CallingHost.of(`host_${each}`),
          NOW,
          TOKEN,
        ),
      ),
    );

    const claimedIds = claimed.flatMap((each) => (each ? [each.id.value] : []));
    expect(claimedIds).toHaveLength(3);
    expect(new Set(claimedIds).size).toBe(3);
  });

  it('stores the response, and does not write over a call that changed', async () => {
    const call = await queued();
    await calls.claimNext(WorkspaceId.of('ws_1'), HOST, NOW, TOKEN);
    const claimed = await calls.find(call.id);
    const response = NetworkResponse.of({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: new TextEncoder().encode('{"deny":"not today"}'),
      ms: 84,
    });

    if (!claimed) {
      throw new Error('nothing was claimed');
    }

    await calls.save(claimed.recordResponse(HOST, response, later(1_000)));

    await expect(
      calls.save(claimed.recordResponse(HOST, response, later(2_000))),
    ).rejects.toThrow(NetworkCallVersionConflictError);

    const clock = { now: () => later(1_500), sleep: async () => {} };
    expect(
      await new NetworkCalls(
        calls,
        { generate: () => 'unused' },
        clock,
      ).stateOf(claimed.id.value),
    ).toEqual({
      kind: 'answered',
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: new TextEncoder().encode('{"deny":"not today"}'),
        ms: 84,
        error: null,
      },
    });
  });

  it('stores no header or body of a call once it is answered or expired', async () => {
    const answered = await queued();
    await calls.claimNext(WorkspaceId.of('ws_1'), HOST, NOW, TOKEN);
    const claimed = await calls.find(answered.id);

    if (!claimed) {
      throw new Error('nothing was claimed');
    }

    await calls.save(
      claimed.recordResponse(
        HOST,
        NetworkResponse.of({ status: 204, ms: 3 }),
        later(1_000),
      ),
    );
    const expired = await queued({ at: later(-20_000), expiresAt: later(-1) });
    const [expiring, ...more] = await calls.expiringBy(NOW, 10);

    expect(expiring?.id).toEqual(expired.id);
    expect(more).toEqual([]);

    await calls.save((expiring as NetworkCall).expire(NOW));

    const stored = await database.db
      .select({
        id: networkCall.id,
        state: networkCall.state,
        headers: networkCall.headers,
        body: networkCall.body,
        url: networkCall.url,
        responseStatus: networkCall.responseStatus,
      })
      .from(networkCall);

    expect(stored.sort((one, other) => one.id.localeCompare(other.id))).toEqual(
      [
        {
          id: answered.id.value,
          state: 'answered',
          headers: {},
          body: '',
          url: 'http://audit.internal:8080/hooks',
          responseStatus: 204,
        },
        {
          id: expired.id.value,
          state: 'expired',
          headers: {},
          body: '',
          url: 'http://audit.internal:8080/hooks',
          responseStatus: null,
        },
      ].sort((one, other) => one.id.localeCompare(other.id)),
    );
    expect((await calls.find(expired.id))?.stateAt(NOW)).toBe('expired');
  });

  it('remembers that a host claimed a call that expired unanswered', async () => {
    const call = await queued({ workspace: 'ws_unanswered' });
    await calls.claimNext(WorkspaceId.of('ws_unanswered'), HOST, NOW, TOKEN);
    const claimed = await calls.find(call.id);
    await calls.save((claimed as NetworkCall).expire(later(15_000)));

    expect((await calls.find(call.id))?.progress).toEqual({
      kind: 'expired',
      at: later(15_000),
      claimed: true,
    });
  });

  it('keeps a cancelled call as cancelled, and purges completed calls a week on', async () => {
    const waited = await queued();
    await calls.save(waited.cancel(later(1_000)));

    const read = await calls.find(waited.id);
    expect(read?.progress).toEqual({
      kind: 'cancelled',
      at: later(1_000),
      claimed: false,
    });

    const week = 7 * 24 * 60 * 60_000;
    expect(await calls.completedBy(later(1_000 - 1), 10)).toEqual([]);

    const [completed] = await calls.completedBy(later(1_000), 10);
    expect(completed?.id).toEqual(waited.id);

    await calls.save((completed as NetworkCall).purge(later(1_000 + week)));

    expect(await calls.find(waited.id)).toBeNull();
  });
});
