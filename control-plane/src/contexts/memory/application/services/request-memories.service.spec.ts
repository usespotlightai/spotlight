import type { MemoryDrafterPort } from '@memory/application/ports/memory-drafter.port';
import type {
  RememberedRun,
  WorkPort,
} from '@memory/application/ports/work.port';
import { RequestMemories } from '@memory/application/services/request-memories.service';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');

const RUN_ORDERED_AT = new Date('2026-09-01T00:00:00.000Z');
const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');

const ENDED: RememberedRun = {
  id: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TASK,
  attempt: 1,
  orderedAt: RUN_ORDERED_AT,
  memories: true,
  briefed: [],
  omitted: [],
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
      run: async (id: RunId) => ({ ...ENDED, id, ...input.run }),
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
    {
      availableTo: async () => input.available ?? true,
    } as unknown as MemoryDrafterPort,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => 'draft_1' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return {
    runEnded: (runId = RUN, handsOver = true) =>
      service.runEnded(TASK, runId, handsOver),
    turnAwaited: (attempt: number, handsOver = true) =>
      service.turnAwaited(TASK, RUN, attempt, handsOver),
    added,
    saved,
  };
};

describe('requesting memories when a run ends', () => {
  it('requests a draft of a completed run at a station that has memories turned on', async () => {
    const requested = requesting({});

    await requested.runEnded();

    expect(requested.added).toHaveLength(1);
    expect(
      requested.added[0]?.drafting?.isFor(AgentTurn.of(RUN, 1, RUN_ORDERED_AT)),
    ).toBe(true);
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

  it('requests nothing after a run that hands nothing over', async () => {
    const requested = requesting({});

    await requested.runEnded(RUN, false);

    expect(requested.added).toHaveLength(0);
  });

  it('requests nothing where the station does not have memories turned on', async () => {
    const requested = requesting({ run: { memories: false } });

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

  it('drafts the attempt the run ended in', async () => {
    const requested = requesting({ run: { attempt: 3 } });

    await requested.runEnded();

    expect(
      requested.added[0]?.drafting?.isFor(AgentTurn.of(RUN, 3, RUN_ORDERED_AT)),
    ).toBe(true);
  });
});

describe('requesting memories when a kept run awaits a person', () => {
  it('requests a draft of the turn the run handed over, though the run has not ended', async () => {
    const requested = requesting({});

    await requested.turnAwaited(2);

    expect(requested.added).toHaveLength(1);
    expect(
      requested.added[0]?.drafting?.isFor(AgentTurn.of(RUN, 2, RUN_ORDERED_AT)),
    ).toBe(true);
  });

  it('requests the draft again for a later turn of the same run', async () => {
    const first = requesting({});
    await first.turnAwaited(1);

    const again = requesting({ existing: first.added[0] });
    await again.turnAwaited(2);

    expect(again.saved).toHaveLength(1);
    expect(
      again.saved[0]?.drafting?.isFor(AgentTurn.of(RUN, 2, RUN_ORDERED_AT)),
    ).toBe(true);
  });

  it('does not request again when the run ends after the turn it handed over', async () => {
    const first = requesting({});
    await first.turnAwaited(1);

    const ended = requesting({ existing: first.added[0] });
    await ended.runEnded();

    expect(ended.saved).toHaveLength(0);
  });

  it('requests nothing after a turn that hands nothing over', async () => {
    const requested = requesting({});

    await requested.turnAwaited(1, false);

    expect(requested.added).toHaveLength(0);
  });

  it('leaves the draft of a later run alone when an earlier run’s turn arrives late', async () => {
    const later = requesting({
      run: { orderedAt: new Date('2026-09-02T00:00:00.000Z') },
    });
    await later.runEnded(RunId.of('run_2'));

    const late = requesting({ existing: later.added[0] });
    await late.turnAwaited(1);
    await late.runEnded();

    expect(late.saved).toHaveLength(0);
  });

  it('requests nothing for a run with no order', async () => {
    const requested = requesting({ run: { orderedAt: null } });

    await requested.runEnded();

    expect(requested.added).toHaveLength(0);
  });

  it('requests nothing where the station does not have memories turned on', async () => {
    const requested = requesting({ run: { memories: false } });

    await requested.turnAwaited(1);

    expect(requested.added).toHaveLength(0);
  });
});
