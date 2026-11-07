import type { RunRepository } from '@runs/application/ports/run-fixtures.fake-spec';
import {
  Run,
  RunPolicy,
  RunRequester,
  RunSpec,
  Runs,
  runReadModelOver,
} from '@runs/application/ports/run-fixtures.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { RunWorks } from '@work/application/services/run-works.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import type { DispatchSubject } from '@work/domain/value-objects/dispatch-subject';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';

const ORDERED_AT = new Date('2026-09-01T09:00:00.000Z');

const dispatched = (id: RunId, subject: DispatchSubject): Dispatch =>
  Dispatch.ordered({
    id,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: null,
    subject,
    configuredAs: null,
    order: runOrderOf(id),
    now: ORDERED_AT,
  }).enqueuedAsRun();

export const aTaskDispatch = (
  id: RunId,
  taskId: TaskId,
  stationId: StationId,
): Dispatch =>
  dispatched(id, {
    kind: 'task',
    taskId,
    revision: TaskRevision.of(0),
    stationId,
  });

export const aChatDispatch = (id: RunId, chatId: ChatId): Dispatch =>
  dispatched(id, { kind: 'chat', chatId });

export const dispatchesOf = (
  ...dispatches: readonly Dispatch[]
): DispatchRepository =>
  ({
    find: async (id: RunId) =>
      dispatches.find((each) => each.id.equals(id)) ?? null,
  }) as unknown as DispatchRepository;

export type RunRequested = 'task' | 'chat' | 'trial' | 'search' | 'spec';

const REQUESTERS: Readonly<
  Record<RunRequested, { readonly owner: string; readonly kind: string }>
> = {
  task: { owner: 'work', kind: 'task' },
  chat: { owner: 'work', kind: 'chat' },
  trial: { owner: 'replays', kind: 'replay' },
  search: { owner: 'replays', kind: 'search' },
  spec: { owner: 'workspace', kind: 'spec' },
};

export const aRunFor = (
  id: RunId,
  harness: string,
  requested: RunRequested = 'task',
): Run => {
  const isolated = requested === 'trial' || requested === 'search';

  return Run.rehydrate({
    id,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of(harness),
    priority: RunPriority.normal,
    requester: RunRequester.of({
      ...REQUESTERS[requested],
      id: id.value,
      token: requested === 'task' ? '0' : null,
      team: null,
    }),
    policy: RunPolicy.of({
      holdsTurn: requested === 'task',
      gated: requested === 'task',
      actsBeyondItself: !isolated,
      asks: isolated ? 'recorded' : 'requester',
      listed: !isolated,
      exclusive: requested === 'task' || requested === 'chat',
    }),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
    state: 'queued',
    claimedBy: null,
    leaseExpiresAt: null,
    outcome: null,
    attempt: 1,
    reservation: null,
    provisioning: Provisioning.none(),
    version: 0,
    queuedAt: ORDERED_AT,
    createdAt: ORDERED_AT,
  });
};

export const runWorksOver = (
  runs: RunRepository,
  tasks: TaskRepository,
  chats: ChatRepository,
  lines: LineMapsPort,
  dispatches: DispatchRepository,
  clock: ClockPort,
): RunWorks =>
  new RunWorks(
    runReadModelOver(runs),
    new Runs(runs, { sha256: (text) => text }, clock),
    tasks,
    chats,
    lines,
    dispatches,
    clock,
  );
