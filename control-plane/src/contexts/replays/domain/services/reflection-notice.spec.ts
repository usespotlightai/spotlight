import { reflectionNotice } from '@replays/domain/services/reflection-notice';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { ReflectionOutcome } from '@replays/domain/value-objects/reflection-outcome';
import {
  SearchCause,
  type SearchCauseKind,
} from '@replays/domain/value-objects/search-cause.vo';
import { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const task = (id: string) =>
  ReflectedTask.of({
    taskId: TaskId.of(id),
    originalRunId: RunId.of(`original_${id}`),
    replayRunId: RunId.of(`replayed_${id}`),
  });

const reflection = (
  causes: readonly SearchCauseKind[],
  outcome: ReflectionOutcome | null,
): SearchIteration => {
  const tasks = causes.map((_, at) => task(`task_${at}`));

  return SearchIteration.rehydrate({
    number: 3,
    runId: RunId.of('search_run_3'),
    kind: 'reflect',
    state: 'ended',
    proposals: [],
    attempts: 0,
    agentSpent: null,
    incumbent: CandidateId.of('candidate_live'),
    outcome,
    reflectedOn: tasks,
    causes: causes.map((cause, at) =>
      SearchCause.of({
        task: tasks[at] as ReflectedTask,
        cause,
        evidence: 'It shows.',
        suggestion: null,
        at: new Date('2026-10-01T09:00:00.000Z'),
      }),
    ),
  });
};

describe('reflectionNotice', () => {
  it('tells of a reflection that ended its search, whatever it found, with why', () => {
    expect(reflectionNotice(reflection([], 'no-failures'))).toEqual({
      outcome: 'no-failures',
      endedSearch: true,
      looked: 0,
      fixes: [],
    });
    expect(
      reflectionNotice(
        reflection(['task', 'judge'], 'no-config-cause'),
      )?.fixes.map((each) => each.cause),
    ).toEqual(['task', 'judge']);
    expect(
      reflectionNotice(reflection(['config'], 'out-of-budget'))?.endedSearch,
    ).toBe(true);
  });

  it('tells of a search going on only for the fixes it found outside the config, and of nothing before it ended', () => {
    expect(reflectionNotice(reflection(['config'], 'went-on'))).toBeNull();
    expect(
      reflectionNotice(reflection(['config', 'check'], 'went-on'))?.fixes.map(
        (each) => each.cause,
      ),
    ).toEqual(['check']);
    expect(reflectionNotice(reflection(['task'], null))).toBeNull();
  });
});
