import type { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { UpkeepReactions } from '@memory/application/events/handlers/upkeep-reactions.handler';
import type { DeleteMemoryDraft } from '@memory/application/services/delete-memory-draft.service';
import type { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import type { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import type { RequestMemories } from '@memory/application/services/request-memories.service';
import { memorySubscribers } from '@memory/presentation/events/memory.subscribers';
import { TASK_TURN_AWAITED } from '@shared-kernel/application/integration-events/task-turn-awaited.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it, vi } from 'vitest';

const subscribed = () => {
  const turnAwaited = vi.fn(async () => undefined);
  const subscribers = memorySubscribers(
    { turnAwaited } as unknown as RequestMemories,
    {} as DeleteMemoryDraft,
    {} as DeleteTeamMemories,
    {} as MemoryReactions,
    {} as RecordRunMemoryUses,
    {} as UpkeepReactions,
  );
  const subscriber = subscribers.find(
    (each) => each.name === 'memory.request-memories-of-awaited-turn',
  );

  if (!subscriber) {
    throw new Error(
      'memory.request-memories-of-awaited-turn is not subscribed',
    );
  }

  return { subscriber, turnAwaited };
};

const awaited = (handsOver: boolean) => ({
  kind: TASK_TURN_AWAITED,
  taskId: 'task_1',
  workspaceId: 'ws_1',
  runId: 'run_1',
  attempt: 2,
  handsOver,
});

describe('memory subscribers', () => {
  it('requests memories of the turn a kept run handed to a person', async () => {
    const { subscriber, turnAwaited } = subscribed();

    expect(subscriber.kinds).toEqual([TASK_TURN_AWAITED]);

    await subscriber.handle(awaited(true), anOutboxRecord());

    expect(turnAwaited).toHaveBeenCalledWith(
      TaskId.of('task_1'),
      RunId.of('run_1'),
      2,
      true,
    );
  });

  it('passes on that the turn hands nothing over', async () => {
    const { subscriber, turnAwaited } = subscribed();

    await subscriber.handle(awaited(false), anOutboxRecord());

    expect(turnAwaited).toHaveBeenCalledWith(
      TaskId.of('task_1'),
      RunId.of('run_1'),
      2,
      false,
    );
  });
});
