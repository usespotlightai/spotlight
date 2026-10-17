import type { MemoryDrafterPort } from '@memory/application/ports/memory-drafter.port';
import type {
  RememberedRun,
  WorkPort,
} from '@memory/application/ports/work.port';
import { RequestMemories } from '@memory/application/services/request-memories.service';
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

const requesting = (input: {
  run?: Partial<RememberedRun>;
  available?: boolean;
  existing?: MemoryDraft | null;
}) => {
  const added: MemoryDraft[] = [];
  const saved: MemoryDraft[] = [];

  const service = new RequestMemories(
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
      forTask: async () => input.existing ?? null,
      add: async (draft: MemoryDraft) => {
        added.push(draft);
      },
      save: async (draft: MemoryDraft) => {
        saved.push(draft);
      },
    } as unknown as MemoryDraftRepository,
    { available: input.available ?? true } as MemoryDrafterPort,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'draft_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return {
    runEnded: (runId = RUN) => service.runEnded(TASK, runId),
    added,
    saved,
  };
};

describe('requesting memories when a run ends', () => {
  it('requests a draft of a completed run at a station that has memories turned on', async () => {
    const requested = requesting({});

    await requested.runEnded();

    expect(requested.added).toHaveLength(1);
    expect(requested.added[0]?.drafting?.isFor(RUN)).toBe(true);
    expect(requested.added[0]?.taskId.equals(TASK)).toBe(true);
  });

  it('requests the task’s draft again for a later run', async () => {
    const first = requesting({});
    await first.runEnded();

    const again = requesting({ existing: first.added[0] });
    await again.runEnded(RunId.of('run_2'));

    expect(again.added).toHaveLength(0);
    expect(again.saved).toHaveLength(1);
  });

  it('requests nothing where the station does not have memories turned on', async () => {
    const requested = requesting({ run: { memories: false } });

    await requested.runEnded();

    expect(requested.added).toHaveLength(0);
  });

  it('requests nothing for a run that did not complete', async () => {
    const requested = requesting({ run: { completed: false } });

    await requested.runEnded();

    expect(requested.added).toHaveLength(0);
  });

  it('does not request again for a run already being drafted, so drafting under way is left alone', async () => {
    const first = requesting({});
    await first.runEnded();

    const again = requesting({ existing: first.added[0] });
    await again.runEnded();

    expect(again.saved).toHaveLength(0);
  });

  it('requests nothing when no model is set up to draft', async () => {
    const requested = requesting({ available: false });

    await requested.runEnded();

    expect(requested.added).toHaveLength(0);
  });
});
