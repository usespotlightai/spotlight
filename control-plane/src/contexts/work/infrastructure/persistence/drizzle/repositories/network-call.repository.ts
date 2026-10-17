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
import { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
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

  if (row.state === 'lapsed' || row.state === 'given-up') {
    if (!row.lapsedAt) {
      throw new InconsistentStateError(
        'network call',
        `was settled at no time (${row.id})`,
      );
    }

    return { kind: row.state, at: row.lapsedAt };
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
    !row.answeredAt ||
    row.answerStatus === null ||
    row.answerMs === null
  ) {
    throw new InconsistentStateError(
      'network call',
      `stands in no state it could be in (${row.id})`,
    );
  }

  return {
    kind: 'answered',
    by,
    claimedAt: row.claimedAt,
    at: row.answeredAt,
    answer: NetworkAnswer.of({
      status: row.answerStatus,
      headers: row.answerHeaders ?? {},
      body: bytesOf(row.answerBody),
      ms: row.answerMs,
      error: row.answerError,
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
    lapsesAt: row.lapsesAt,
    progress: progressOf(row),
    version: row.version,
  });

const progressColumns = (progress: NetworkCallProgress) => {
  if (progress.kind === 'waiting') {
    return { state: 'waiting', claimedBy: null, claimedAt: null };
  }

  if (progress.kind === 'lapsed' || progress.kind === 'given-up') {
    return { state: progress.kind, lapsedAt: progress.at };
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
    answeredAt: progress.at,
    answerStatus: progress.answer.status,
    answerHeaders: { ...progress.answer.headers },
    answerBody: base64Of(progress.answer.body),
    answerMs: progress.answer.ms,
    answerError: progress.answer.error,
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
        lapsesAt: added.lapsesAt,
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

  async lapsingBy(now: Date, max: number): Promise<readonly NetworkCall[]> {
    const rows = await this.context.db
      .select()
      .from(networkCall)
      .where(
        and(
          inArray(networkCall.state, ['waiting', 'claimed']),
          lte(networkCall.lapsesAt, now),
        ),
      )
      .orderBy(asc(networkCall.lapsesAt))
      .limit(max);

    return rows.map(toCall);
  }

  async settledBy(at: Date, max: number): Promise<readonly NetworkCall[]> {
    const rows = await this.context.db
      .select()
      .from(networkCall)
      .where(
        or(
          and(
            eq(networkCall.state, 'answered'),
            lte(networkCall.answeredAt, at),
          ),
          and(
            inArray(networkCall.state, ['lapsed', 'given-up']),
            lte(networkCall.lapsedAt, at),
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
            gt(networkCall.lapsesAt, now),
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
