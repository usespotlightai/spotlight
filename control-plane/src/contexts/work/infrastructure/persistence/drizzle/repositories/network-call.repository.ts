import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  NetworkCall,
  type NetworkCallProgress,
} from '@work/domain/aggregates/network-call.aggregate';
import { NetworkCallVersionConflictError } from '@work/domain/exceptions/network-call-version-conflict.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
import { networkCall } from '@work/infrastructure/persistence/drizzle/schemas/network-call.schema';
import { and, asc, eq, gt, inArray, lte, or } from 'drizzle-orm';

type Row = typeof networkCall.$inferSelect;

const bytesOf = (base64: string | null): Uint8Array =>
  new Uint8Array(Buffer.from(base64 ?? '', 'base64'));

const base64Of = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64');

const progressOf = (row: Row): NetworkCallProgress => {
  if (row.state === 'waiting') {
    return { kind: 'waiting' };
  }

  if (row.state === 'expired' || row.state === 'cancelled') {
    if (!row.expiredAt) {
      throw new InconsistentStateError(
        'network call',
        `was completed at no time (${row.id})`,
      );
    }

    return { kind: row.state, at: row.expiredAt };
  }

  if (!row.claimedBy || !row.claimedAt) {
    throw new InconsistentStateError(
      'network call',
      `is ${row.state} by no host (${row.id})`,
    );
  }

  const by = CallingHost.of(row.claimedBy);

  if (row.state === 'claimed') {
    return { kind: 'claimed', by, at: row.claimedAt };
  }

  if (
    row.state !== 'answered' ||
    !row.respondedAt ||
    row.responseStatus === null ||
    row.responseMs === null
  ) {
    throw new InconsistentStateError(
      'network call',
      `is in no state it could be in (${row.id})`,
    );
  }

  return {
    kind: 'answered',
    by,
    claimedAt: row.claimedAt,
    at: row.respondedAt,
    response: NetworkResponse.of({
      status: row.responseStatus,
      headers: row.responseHeaders ?? {},
      body: bytesOf(row.responseBody),
      ms: row.responseMs,
      error: row.responseError,
    }),
  };
};

const toCall = (row: Row): NetworkCall =>
  NetworkCall.rehydrate({
    id: NetworkCallId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    request: NetworkRequest.of({
      method: row.method,
      url: row.url,
      headers: row.headers,
      body: bytesOf(row.body),
      timeoutMs: row.timeoutMs,
    }),
    queuedAt: row.queuedAt,
    expiresAt: row.expiresAt,
    progress: progressOf(row),
    version: row.version,
  });

const progressColumns = (progress: NetworkCallProgress) => {
  if (progress.kind === 'waiting') {
    return { state: 'waiting', claimedBy: null, claimedAt: null };
  }

  if (progress.kind === 'expired' || progress.kind === 'cancelled') {
    return { state: progress.kind, expiredAt: progress.at };
  }

  if (progress.kind === 'claimed') {
    return {
      state: 'claimed',
      claimedBy: progress.by.value,
      claimedAt: progress.at,
    };
  }

  return {
    state: 'answered',
    claimedBy: progress.by.value,
    claimedAt: progress.claimedAt,
    respondedAt: progress.at,
    responseStatus: progress.response.status,
    responseHeaders: { ...progress.response.headers },
    responseBody: base64Of(progress.response.body),
    responseMs: progress.response.ms,
    responseError: progress.response.error,
  };
};

@Injectable()
export class DrizzleNetworkCallRepository implements NetworkCallRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: NetworkCall): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(networkCall).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        method: added.request.method,
        url: added.request.url,
        headers: { ...added.request.headers },
        body: base64Of(added.request.body),
        timeoutMs: added.request.timeoutMs,
        queuedAt: added.queuedAt,
        expiresAt: added.expiresAt,
        ...progressColumns(added.progress),
        version: added.version,
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: NetworkCall): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(networkCall.id, saved.id.value),
        eq(networkCall.version, saved.version),
      );
      const written = saved.isDiscarded
        ? await this.context.db
            .delete(networkCall)
            .where(matching)
            .returning({ id: networkCall.id })
        : await this.context.db
            .update(networkCall)
            .set({
              headers: { ...saved.request.headers },
              body: base64Of(saved.request.body),
              ...progressColumns(saved.progress),
              version: saved.version + 1,
            })
            .where(matching)
            .returning({ id: networkCall.id });

      if (written.length === 0) {
        throw new NetworkCallVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: NetworkCallId): Promise<NetworkCall | null> {
    const [row] = await this.context.db
      .select()
      .from(networkCall)
      .where(eq(networkCall.id, id.value))
      .limit(1);

    return row ? toCall(row) : null;
  }

  async expiringBy(now: Date, max: number): Promise<readonly NetworkCall[]> {
    const rows = await this.context.db
      .select()
      .from(networkCall)
      .where(
        and(
          inArray(networkCall.state, ['waiting', 'claimed']),
          lte(networkCall.expiresAt, now),
        ),
      )
      .orderBy(asc(networkCall.expiresAt))
      .limit(max);

    return rows.map(toCall);
  }

  async completedBy(at: Date, max: number): Promise<readonly NetworkCall[]> {
    const rows = await this.context.db
      .select()
      .from(networkCall)
      .where(
        or(
          and(
            eq(networkCall.state, 'answered'),
            lte(networkCall.respondedAt, at),
          ),
          and(
            inArray(networkCall.state, ['expired', 'cancelled']),
            lte(networkCall.expiredAt, at),
          ),
        ),
      )
      .limit(max);

    return rows.map(toCall);
  }

  async claimNext(
    workspaceId: WorkspaceId,
    by: CallingHost,
    now: Date,
  ): Promise<NetworkCall | null> {
    return this.context.inTransaction(async () => {
      const [row] = await this.context.db
        .select()
        .from(networkCall)
        .where(
          and(
            eq(networkCall.workspaceId, workspaceId.value),
            eq(networkCall.state, 'waiting'),
            gt(networkCall.expiresAt, now),
          ),
        )
        .orderBy(asc(networkCall.queuedAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (!row) {
        return null;
      }

      const claimed = toCall(row).claimedBy(by, now);
      await this.save(claimed);

      return claimed;
    });
  }
}
