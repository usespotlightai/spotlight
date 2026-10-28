import {
  ReflectionNoticeWording,
  UnreflectedStallWording,
} from '@replays/application/rendering/reflection-notice';
import {
  FailureCause,
  type FailureCauseKind,
} from '@replays/domain/value-objects/failure-cause.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const cause = (
  at: number,
  kind: FailureCauseKind,
  suggestion: string | null = null,
) =>
  FailureCause.of({
    task: ReflectedTask.of({
      taskId: TaskId.of(`task_${at}`),
      originalRunId: RunId.of(`original_${at}`),
      replayRunId: RunId.of(`replayed_${at}`),
    }),
    cause: kind,
    evidence: `Evidence ${at}.`,
    suggestion,
    at: new Date('2026-10-01T09:00:00.000Z'),
  });

const TITLES = new Map<string, string | null>([
  ['original_1', 'Drain the queue on restart'],
  ['original_2', null],
]);

describe('ReflectionNoticeWording', () => {
  it('names each fix outside the config by its task’s title, and its suggestion or else its evidence', () => {
    const points = ReflectionNoticeWording.pointsOf(
      {
        result: 'no-config-cause',
        endedSearch: true,
        looked: 2,
        fixes: [
          cause(1, 'judge', 'Drop the test requirement.'),
          cause(2, 'task'),
        ],
      },
      TITLES,
    );

    expect(points).toEqual([
      'No config change can fix the 2 tasks still failing. The rest of the budget stays unspent.',
      'Fix the judge’s rubric, for “Drain the queue on restart”: Drop the test requirement.',
      'Take the task out of the replay set, or reword it, for one of the searched tasks: Evidence 2.',
    ]);
  });

  it('keeps to twenty points, counting the rest', () => {
    const many = Array.from({ length: 25 }, (_, at) => cause(at, 'infra'));
    const points = ReflectionNoticeWording.pointsOf(
      {
        result: 'no-config-cause',
        endedSearch: true,
        looked: 25,
        fixes: many,
      },
      TITLES,
    );

    expect(points).toHaveLength(20);
    expect(points[19]).toBe('The search page shows 7 more.');
  });

  it('always says what happened first, even with nothing for a person to fix', () => {
    for (const result of [
      'continued',
      'no-config-cause',
      'no-failures',
      'did-not-run',
      'ceiling-reached',
    ] as const) {
      const points = ReflectionNoticeWording.pointsOf(
        { result, endedSearch: result !== 'continued', looked: 1, fixes: [] },
        TITLES,
      );

      expect(points).toHaveLength(1);
      expect(points[0]).toMatch(/^[A-Z].+\.$/);
    }
  });
});

describe('UnreflectedStallWording', () => {
  it('says the search stalled with no budget left to look into why', () => {
    expect(UnreflectedStallWording.points).toEqual([
      'Two iterations in a row found nothing better. No budget was left to find out why.',
    ]);
  });
});
