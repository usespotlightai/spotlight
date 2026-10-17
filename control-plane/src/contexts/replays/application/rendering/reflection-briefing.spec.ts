import { ReflectionBriefing } from '@replays/application/rendering/reflection-briefing';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const briefing = (seed: boolean) =>
  ReflectionBriefing.of({
    stationKey: 'build',
    stationName: 'Build',
    lineKey: 'delivery',
    iteration: 3,
    iterations: 5,
    incumbentName: seed ? 'seed' : 'in-order',
    seed,
    tasks: [
      ReflectedTask.of({
        taskId: TaskId.of('task_1'),
        originalRunId: RunId.of('original_1'),
        replayRunId: RunId.of('replayed_1'),
      }),
    ],
  });

describe('ReflectionBriefing', () => {
  it('asks for one cause per failing task, and no candidate', () => {
    const said = briefing(false);

    expect(said).toContain('| `task_1` | `original_1` | `replayed_1` |');
    expect(said).toContain(
      'spotlight cause --task <task> --cause config|task|judge|check|infra --evidence <text | @file> [--suggestion <text | @file>]',
    );
    expect(said).toContain('Spotlight rejects `spotlight candidate` from it');
    expect(said).toContain('spotlight history --station build --line delivery');
    expect(said).toContain('`candidates/in-order/runs/<original run>/`');
    expect(said).toContain(
      'The best config so far is the candidate `in-order`',
    );
  });

  it('names the live config when nothing beat it', () => {
    expect(briefing(true)).toContain(
      'The best config so far is the live config the search started from, `seed`',
    );
  });
});
