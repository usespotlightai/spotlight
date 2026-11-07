import type {
  RunPolicyContract,
  RunRequesterContract,
} from '@runs/application/contracts/run-order.contract';
import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import {
  leasedRun,
  recordingRuns,
} from '@work/application/ports/runs.fake-spec';
import { RunWorks } from '@work/application/services/run-works.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import type { DispatchSubject } from '@work/domain/value-objects/dispatch-subject';
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

const requesterFor = (
  id: RunId,
  requested: RunRequested,
): RunRequesterContract => ({
  ...REQUESTERS[requested],
  id: id.value,
  token: requested === 'task' ? '0' : null,
  team: null,
});

const policyFor = (requested: RunRequested): RunPolicyContract => {
  const isolated = requested === 'trial' || requested === 'search';

  return {
    holdsTurn: requested === 'task',
    gated: requested === 'task',
    actsBeyondItself: !isolated,
    asks: isolated ? 'recorded' : 'requester',
    listed: !isolated,
    exclusive: requested === 'task' || requested === 'chat',
  };
};

export const leasedRunFor = (
  id: RunId,
  harness: string,
  requested: RunRequested = 'task',
  part: Partial<LeasedRunFacts> = {},
): LeasedRunFacts =>
  leasedRun({
    runId: id,
    harness: HarnessId.of(harness),
    requester: requesterFor(id, requested),
    policy: policyFor(requested),
    team: null,
    ...part,
  });

export const runWorksOver = (
  leases: RunLeasesPort,
  tasks: TaskRepository,
  chats: ChatRepository,
  lines: LineMapsPort,
  dispatches: DispatchRepository,
  clock: ClockPort,
  runs: RunsPort = recordingRuns(),
): RunWorks =>
  new RunWorks(leases, runs, tasks, chats, lines, dispatches, clock);
