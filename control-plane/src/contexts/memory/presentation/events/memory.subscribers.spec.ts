import type { DuplicateCheckReactions } from '@memory/application/events/handlers/duplicate-check-reactions.handler';
import type { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { UpkeepReactions } from '@memory/application/events/handlers/upkeep-reactions.handler';
import type { DeleteMemoryProposalSet } from '@memory/application/services/delete-memory-proposal-set.service';
import type { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import type { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import type { WakeDuplicateChecks } from '@memory/application/services/wake-duplicate-checks.service';
import type { WakeUpkeepSweeps } from '@memory/application/services/wake-upkeep-sweeps.service';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import {
  ASSIST_SESSION_SETTLED,
  type AssistSessionSettledIntegrationEvent,
} from '@shared-kernel/application/integration-events/assist-session-settled.integration-event';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  TASK_TURN_AWAITED,
  type TaskTurnAwaitedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-turn-awaited.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it, vi } from 'vitest';

const subscribers = (input: {
  waking?: Partial<WakeUpkeepSweeps>;
  checking?: Partial<DuplicateCheckReactions>;
  wakingChecks?: Partial<WakeDuplicateChecks>;
}) =>
  memorySubscribers(
    partial<DeleteMemoryProposalSet>({}),
    partial<DeleteTeamMemories>({}),
    partial<MemoryReactions>({}),
    partial<RecordRunMemoryUses>({}),
    partial<UpkeepReactions>({}),
    partial<WakeUpkeepSweeps>(input.waking ?? {}),
    partial<DuplicateCheckReactions>(input.checking ?? {}),
    partial<WakeDuplicateChecks>(input.wakingChecks ?? {}),
  );

const SETTLED: AssistSessionSettledIntegrationEvent = {
  kind: ASSIST_SESSION_SETTLED,
  workspaceId: 'ws_1',
  purpose: 'memory.compare-proposals',
  key: 'run_7',
  outcome: 'submitted',
};

describe('memory receiving a settled assist session', () => {
  it('wakes the sweep that waits for the session', async () => {
    const settled = vi.fn(async () => {});
    const subscriber = subscribers({ waking: { settled } }).find(
      (each) => each.name === 'memory.wake-on-assist-session-settled',
    );
    const event: AssistSessionSettledIntegrationEvent = {
      kind: ASSIST_SESSION_SETTLED,
      workspaceId: 'ws_1',
      purpose: 'memory.consolidate',
      key: 'team_1:1795348367000:1',
      outcome: 'submitted',
    };

    await subscriber?.handle(event, anOutboxRecord());

    expect(subscriber?.name).toBe('memory.wake-on-assist-session-settled');
    expect(settled).toHaveBeenCalledWith({
      purpose: 'memory.consolidate',
      key: 'team_1:1795348367000:1',
    });
  });
});

describe('memory checking a run’s proposals for duplicates', () => {
  it('wakes the duplicate check that waits for the session, in its own subscriber', async () => {
    const settled = vi.fn(async () => {});
    const heard = subscribers({ wakingChecks: { settled } }).filter((each) =>
      each.kinds.includes(ASSIST_SESSION_SETTLED),
    );
    const subscriber = heard.find(
      (each) =>
        each.name === 'memory.wake-duplicate-check-on-assist-session-settled',
    );

    await subscriber?.handle(SETTLED, anOutboxRecord());

    expect(heard).toHaveLength(2);
    expect(settled).toHaveBeenCalledWith({
      purpose: 'memory.compare-proposals',
      key: 'run_7',
    });
  });

  it('opens the check of a run once its dispatch ended', async () => {
    const onRunEnded = vi.fn(async () => {});
    const subscriber = subscribers({ checking: { onRunEnded } }).find(
      (each) => each.name === 'memory.check-proposed-memories-for-duplicates',
    );
    const event: DispatchEndedIntegrationEvent = {
      kind: DISPATCH_ENDED,
      runId: 'run_7',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      stationId: null,
      driver: 'line',
      outcome: 'completed',
      failure: null,
      stopped: false,
      handsOver: false,
    };

    await subscriber?.handle(event, anOutboxRecord());

    expect(onRunEnded).toHaveBeenCalledWith({
      id: RunId.of('run_7'),
      taskId: TaskId.of('task_1'),
    });
  });

  it('opens the duplicate check of a run once it waits for a person', async () => {
    const onRunEnded = vi.fn(async () => {});
    const subscriber = subscribers({ checking: { onRunEnded } }).find(
      (each) =>
        each.name ===
        'memory.check-proposed-memories-for-duplicates-when-run-waits',
    );
    const event: TaskTurnAwaitedIntegrationEvent = {
      kind: TASK_TURN_AWAITED,
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_7',
      attempt: 1,
      handsOver: false,
    };

    await subscriber?.handle(event, anOutboxRecord());

    expect(onRunEnded).toHaveBeenCalledWith({
      id: RunId.of('run_7'),
      taskId: TaskId.of('task_1'),
    });
  });
});
