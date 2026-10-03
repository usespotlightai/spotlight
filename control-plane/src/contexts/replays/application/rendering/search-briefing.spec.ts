import { SearchBriefing } from '@replays/application/rendering/search-briefing';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const briefed = (
  objective: SearchObjective,
  configCauses: readonly SearchCause[] = [],
) =>
  SearchBriefing.of({
    stationKey: 'build',
    stationName: 'Build',
    lineKey: 'delivery',
    seed: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
    iteration: 1,
    iterations: 3,
    perIteration: 2,
    left: Spend.of(40, 'USD'),
    ceiling: Spend.ceiling(50, 'USD'),
    searchedTasks: 7,
    heldOutTasks: 3,
    objective,
    configCauses,
  });

describe('SearchBriefing', () => {
  it('tells the agent a better candidate succeeds on more tasks when the search looks for success', () => {
    expect(briefed('success')).toContain(
      'A candidate is better when it succeeds on more tasks.',
    );
    expect(briefed('success')).not.toContain('less cost');
  });

  it('tells the agent to find the same success for less when the search looks for cost', () => {
    const briefing = briefed('cost');

    expect(briefing).toContain(
      'this search looks for the same success at less cost',
    );
    expect(briefing).toContain(
      'One that succeeds clearly less often is out, however cheap.',
    );
  });

  it('passes on what looking into a stall found the config could fix, and says nothing of it before', () => {
    const found = SearchCause.of({
      task: ReflectedTask.of({
        taskId: TaskId.of('task_7'),
        originalRunId: RunId.of('original_7'),
        replayRunId: RunId.of('replayed_7'),
      }),
      cause: 'config',
      evidence: 'It never ran the migration the prompt forgot.',
      suggestion: 'Tell it to run migrations first.',
      at: new Date('2026-10-01T09:00:00.000Z'),
    });

    expect(briefed('success')).not.toContain('looking into the stall');
    expect(briefed('success', [found])).toContain(
      '- Task `task_7`: It never ran the migration the prompt forgot. Suggested: Tell it to run migrations first.',
    );
  });
});
