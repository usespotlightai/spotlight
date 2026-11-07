import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import {
  isRunFailureCode,
  type RunFailureCode,
} from '@shared-kernel/domain/value-objects/run-failure-code';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { DispatchVersionConflictError } from '@work/domain/exceptions/dispatch-version-conflict.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import type { DispatchSubject } from '@work/domain/value-objects/dispatch-subject.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';
import { and, eq } from 'drizzle-orm';

type Row = typeof dispatch.$inferSelect;

const subjectColumns = (subject: DispatchSubject) => {
  switch (subject.kind) {
    case 'task':
      return {
        kind: subject.kind,
        taskId: subject.taskId.value,
        taskRevision: subject.revision.value,
        stationId: subject.stationId.value,
      };
    case 'chat':
      return { kind: subject.kind, chatId: subject.chatId.value };
    case 'trial':
      return {
        kind: subject.kind,
        basedOnRunId: subject.basedOn.value,
        taskId: subject.taskId.value,
        stationId: subject.stationId.value,
        asOf: subject.asOf,
        trialRepositories: subject.repositories.map((each) => ({
          path: each.path,
          repository: each.repository.value,
        })),
        followUp: subject.followUp,
      };
  }
};

const failureOf = (failure: string | null): RunFailureCode | null => {
  if (failure === null) {
    return null;
  }

  if (!isRunFailureCode(failure)) {
    throw new InconsistentStateError(
      'dispatch',
      `ended with an unknown failure ${failure}`,
    );
  }

  return failure;
};

const changing = (saved: Dispatch) => ({
  order: saved.order?.snapshot ?? null,
  enqueued: saved.enqueued,
  refused: saved.refusedBecause,
  detachedAt: saved.detachedAt,
  endedAt: saved.ending?.endedAt ?? null,
  outcome: saved.ending?.outcome ?? null,
  failure: saved.ending?.failure ?? null,
  stopped: saved.ending?.stopped ?? false,
  askedAPerson: saved.ending?.askedAPerson ?? false,
  superseded: saved.superseded,
});

const required = <T>(value: T | null, row: Row, what: string): T => {
  if (value === null) {
    throw new InconsistentStateError(
      'dispatch',
      `misses its ${what} (${row.id})`,
    );
  }

  return value;
};

const subjectOf = (row: Row): DispatchSubject => {
  switch (row.kind) {
    case 'task':
      return {
        kind: 'task',
        taskId: TaskId.of(required(row.taskId, row, 'task')),
        revision: TaskRevision.of(required(row.taskRevision, row, 'revision')),
        stationId: StationId.of(required(row.stationId, row, 'station')),
      };
    case 'chat':
      return {
        kind: 'chat',
        chatId: ChatId.of(required(row.chatId, row, 'chat')),
      };
    case 'trial':
      return {
        kind: 'trial',
        basedOn: RunId.of(required(row.basedOnRunId, row, 'original run')),
        taskId: TaskId.of(required(row.taskId, row, 'task')),
        stationId: StationId.of(required(row.stationId, row, 'station')),
        asOf: row.asOf,
        repositories: (row.trialRepositories ?? []).map((each) => ({
          path: each.path,
          repository: Repository.of(each.repository),
        })),
        followUp: row.followUp,
      };
  }
};

const configOf = (row: Row): StationConfig | null => {
  if (row.stationConfig === null && row.stationFingerprint === null) {
    return null;
  }

  return StationConfig.rehydrate(
    required(row.stationConfig, row, 'station config'),
    required(row.stationFingerprint, row, 'station fingerprint'),
  );
};

export const toDispatch = (row: Row): Dispatch =>
  Dispatch.rehydrate({
    id: RunId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: row.teamId ? TeamId.of(row.teamId) : null,
    subject: subjectOf(row),
    order: row.order
      ? DispatchOrder.of({
          kind: DispatchOrder.kindFor(row.kind),
          runId: RunId.of(row.id),
          snapshot: row.order,
        })
      : null,
    briefedTask: row.briefedTask
      ? BriefedTask.rehydrate(row.briefedTask)
      : null,
    briefing: row.briefing,
    briefedMemories: BriefedMemories.of(row.briefedMemories),
    configuredAs: configOf(row),
    orderedAt: row.orderedAt,
    enqueued: row.enqueued,
    refused: row.refused,
    detachedAt: row.detachedAt,
    ending:
      row.endedAt && row.outcome
        ? DispatchEnding.of({
            endedAt: row.endedAt,
            outcome: row.outcome,
            failure: failureOf(row.failure),
            stopped: row.stopped,
            askedAPerson: row.askedAPerson,
          })
        : null,
    superseded: row.superseded,
    version: row.version,
  });

@Injectable()
export class DrizzleDispatchRepository implements DispatchRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Dispatch): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(dispatch)
        .values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId?.value ?? null,
          ...subjectColumns(added.subject),
          briefedTask: added.briefedTask?.parts ?? null,
          briefing: added.briefing,
          briefedMemories: added.briefedMemories.value,
          stationConfig: added.configuredAs?.parts ?? null,
          stationFingerprint: added.configuredAs?.fingerprint ?? null,
          orderedAt: added.orderedAt,
          version: added.version,
          ...changing(added),
        })
        .onConflictDoNothing({ target: dispatch.id })
        .returning({ id: dispatch.id });

      if (written.length === 0) {
        throw new DispatchVersionConflictError(added.id.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Dispatch): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(dispatch)
        .set({ ...changing(saved), version: saved.version + 1 })
        .where(
          and(
            eq(dispatch.id, saved.id.value),
            eq(dispatch.version, saved.version),
          ),
        )
        .returning({ id: dispatch.id });

      if (written.length === 0) {
        throw new DispatchVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: RunId): Promise<Dispatch | null> {
    const [row] = await this.context.db
      .select()
      .from(dispatch)
      .where(eq(dispatch.id, id.value))
      .limit(1);

    return row ? toDispatch(row) : null;
  }
}
