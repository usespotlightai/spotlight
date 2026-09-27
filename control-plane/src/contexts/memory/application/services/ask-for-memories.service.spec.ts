import type { MemoryDrafterPort } from '@memory/application/ports/memory-drafter.port';
import type {
  RememberedRun,
  WorkPort,
} from '@memory/application/ports/work.port';
import { AskForMemories } from '@memory/application/services/ask-for-memories.service';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');

const ENDED: RememberedRun = {
  id: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TASK,
  completed: true,
  memories: true,
  briefed: [],
  cut: [],
};

const asking = (input: {
  run?: Partial<RememberedRun>;
  available?: boolean;
  held?: MemoryDraft | null;
}) => {
  const added: MemoryDraft[] = [];
  const saved: MemoryDraft[] = [];

  const service = new AskForMemories(
    {
      run: async () => ({ ...ENDED, ...input.run }),
      task: async () => ({
        id: TASK,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: null,
        fromOutside: false,
      }),
    } as unknown as WorkPort,
    {
      forTask: async () => input.held ?? null,
      add: async (draft: MemoryDraft) => {
        added.push(draft);
      },
      save: async (draft: MemoryDraft) => {
        saved.push(draft);
      },
    } as unknown as MemoryDraftRepository,
    { available: input.available ?? true } as MemoryDrafterPort,
    { run: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'draft_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return {
    runEnded: (runId = RUN) => service.runEnded(TASK, runId),
    added,
    saved,
  };
};

describe('asking for memories when a run ends', () => {
  it('asks for a draft of a completed run at a station that keeps memories', async () => {
    const asked = asking({});

    await asked.runEnded();

    expect(asked.added).toHaveLength(1);
    expect(asked.added[0]?.drafting?.isFor(RUN)).toBe(true);
    expect(asked.added[0]?.taskId.equals(TASK)).toBe(true);
  });

  it('asks the task’s draft again for a later run', async () => {
    const first = asking({});
    await first.runEnded();

    const again = asking({ held: first.added[0] });
    await again.runEnded(RunId.of('run_2'));

    expect(again.added).toHaveLength(0);
    expect(again.saved).toHaveLength(1);
  });

  it('asks nothing where the station does not keep memories', async () => {
    const asked = asking({ run: { memories: false } });

    await asked.runEnded();

    expect(asked.added).toHaveLength(0);
  });

  it('asks nothing for a run that did not complete', async () => {
    const asked = asking({ run: { completed: false } });

    await asked.runEnded();

    expect(asked.added).toHaveLength(0);
  });

  it('does not ask again for a run already being drafted, so drafting under way is left alone', async () => {
    const first = asking({});
    await first.runEnded();

    const again = asking({ held: first.added[0] });
    await again.runEnded();

    expect(again.saved).toHaveLength(0);
  });

  it('asks nothing when no model is set up to draft', async () => {
    const asked = asking({ available: false });

    await asked.runEnded();

    expect(asked.added).toHaveLength(0);
  });
});
