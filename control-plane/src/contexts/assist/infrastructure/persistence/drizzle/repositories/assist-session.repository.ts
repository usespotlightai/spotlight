import {
  type AssistProgress,
  AssistSession,
} from '@assist/domain/aggregates/assist-session.aggregate';
import { AssistSessionVersionConflictError } from '@assist/domain/exceptions/assist-session-version-conflict.error';
import type { AssistSessionRepository } from '@assist/domain/repositories/assist-session.repository';
import { isAssistFailureReason } from '@assist/domain/value-objects/assist-failure-reason.vo';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';
import { assistSession } from '@assist/infrastructure/persistence/drizzle/schemas/assist-session.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

type Row = typeof assistSession.$inferSelect;

const inconsistent = (because: string): never => {
  throw new InconsistentStateError('assist session', because);
};

const modelOf = (row: Row): string =>
  row.model ?? inconsistent(`was ${row.status} without a model`);

const progressOf = (row: Row): AssistProgress => {
  switch (row.status) {
    case 'ordered':
      return { status: 'ordered' };
    case 'running':
      return { status: 'running', model: modelOf(row) };
    case 'submitted':
      return {
        status: 'submitted',
        model: modelOf(row),
        result: row.result ?? inconsistent('was submitted without a result'),
      };
    case 'failed':
      return row.failure && isAssistFailureReason(row.failure)
        ? { status: 'failed', reason: row.failure }
        : inconsistent(`failed for an unknown reason ${row.failure}`);
    default:
      return inconsistent(`has an unknown status ${row.status}`);
  }
};

const usageOf = (row: Row): ModelCall | null =>
  row.usageRecorded
    ? {
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cost:
          row.cost !== null && row.currency !== null
            ? { amount: row.cost, currency: row.currency }
            : null,
      }
    : null;

const toSession = (row: Row): AssistSession =>
  AssistSession.rehydrate({
    id: AssistSessionId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    purpose: AssistPurpose.of(row.purpose),
    key: AssistSessionKey.of(row.key),
    basedOn: RunId.of(row.basedOnRunId),
    run: RunId.of(row.runId),
    resultSchema: row.resultSchema,
    progress: progressOf(row),
    usage: usageOf(row),
    orderedAt: row.orderedAt,
    settledAt: row.settledAt,
    runEndedAt: row.runEndedAt,
    version: row.version,
  });

const changeableColumnsOf = (session: AssistSession) => {
  const { progress, usage } = session;

  return {
    status: progress.status,
    model:
      progress.status === 'running' || progress.status === 'submitted'
        ? progress.model
        : null,
    result: progress.status === 'submitted' ? progress.result : null,
    failure: progress.status === 'failed' ? progress.reason : null,
    usageRecorded: usage !== null,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    cost: usage?.cost?.amount ?? null,
    currency: usage?.cost?.currency ?? null,
    settledAt: session.settledAt,
    runEndedAt: session.runEndedAt,
  };
};

@Injectable()
export class DrizzleAssistSessionRepository implements AssistSessionRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  findOrdered(
    workspaceId: WorkspaceId,
    purpose: AssistPurpose,
    key: AssistSessionKey,
  ): Promise<AssistSession | null> {
    return this.first(
      and(
        eq(assistSession.workspaceId, workspaceId.value),
        eq(assistSession.purpose, purpose.value),
        eq(assistSession.key, key.value),
      ),
    );
  }

  findByRun(run: RunId): Promise<AssistSession | null> {
    return this.first(eq(assistSession.runId, run.value));
  }

  add(added: AssistSession): Promise<boolean> {
    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(assistSession)
        .values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          purpose: added.purpose.value,
          key: added.key.value,
          basedOnRunId: added.basedOn.value,
          runId: added.run.value,
          resultSchema: added.resultSchema,
          orderedAt: added.orderedAt,
          version: added.version,
          ...changeableColumnsOf(added),
        })
        .onConflictDoNothing({
          target: [
            assistSession.workspaceId,
            assistSession.purpose,
            assistSession.key,
          ],
        })
        .returning({ id: assistSession.id });

      if (written.length === 0) {
        return false;
      }

      await this.events.dispatch(added.pullEvents());
      return true;
    });
  }

  save(saved: AssistSession): Promise<void> {
    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(assistSession)
        .set({ ...changeableColumnsOf(saved), version: saved.version + 1 })
        .where(
          and(
            eq(assistSession.id, saved.id.value),
            eq(assistSession.version, saved.version),
          ),
        )
        .returning({ id: assistSession.id });

      if (written.length === 0) {
        throw new AssistSessionVersionConflictError();
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly AssistSession[]> {
    const rows = await this.context.db
      .select()
      .from(assistSession)
      .where(eq(assistSession.workspaceId, workspaceId.value));

    return rows.map(toSession);
  }

  async remove(removed: AssistSession): Promise<void> {
    const written = await this.context.db
      .delete(assistSession)
      .where(
        and(
          eq(assistSession.id, removed.id.value),
          eq(assistSession.version, removed.version),
        ),
      )
      .returning({ id: assistSession.id });

    if (written.length === 0) {
      throw new AssistSessionVersionConflictError();
    }
  }

  private async first(where: SQL | undefined): Promise<AssistSession | null> {
    const [row] = await this.context.db
      .select()
      .from(assistSession)
      .where(where)
      .limit(1);

    return row ? toSession(row) : null;
  }
}
