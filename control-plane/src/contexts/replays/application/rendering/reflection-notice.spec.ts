import {
  ReflectionNoticeWording,
  UnreflectedStallWording,
} from '@replays/application/rendering/reflection-notice';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import {
  SearchCause,
  type SearchCauseKind,
} from '@replays/domain/value-objects/search-cause.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const cause = (
  at: number,
  kind: SearchCauseKind,
  suggestion: string | null = null,
) =>
  SearchCause.of({
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
    const wording = ReflectionNoticeWording.of(
      {
        outcome: 'no-config-cause',
        endedSearch: true,
        looked: 2,
        fixes: [
          cause(1, 'judge', 'Drop the test requirement.'),
          cause(2, 'task'),
        ],
      },
      'Build',
      TITLES,
    );

    expect(wording.headline).toBe(
      'The search for a better Build config ended with nothing the config can fix',
    );
    expect(wording.points).toEqual([
      'No config change can fix the 2 tasks still failing. The rest of the budget stays unspent.',
      'Fix the judge’s rubric, for “Drain the queue on restart”: Drop the test requirement.',
      'Take the task out of the replay set, or reword it, for one of the searched tasks: Evidence 2.',
    ]);
  });

  it('says why the search stopped or that it went on', () => {
    const headline = (
      outcome:
        | 'went-on'
        | 'no-failures'
        | 'did-not-run'
        | 'out-of-budget'
        | 'no-config-cause',
    ) =>
      ReflectionNoticeWording.of(
        { outcome, endedSearch: outcome !== 'went-on', looked: 1, fixes: [] },
        null,
        TITLES,
      ).headline;

    expect(headline('went-on')).toBe(
      'The search for a better station config goes on after finding failures outside the config',
    );
    expect(headline('no-failures')).toBe(
      'The search for a better station config ended with every searched task passing',
    );
    expect(headline('did-not-run')).toBe(
      'The search for a better station config ended after its reflection failed',
    );
    expect(headline('out-of-budget')).toBe(
      'The search for a better station config ran out of budget',
    );
  });

  it('keeps to twenty points, counting the rest', () => {
    const many = Array.from({ length: 25 }, (_, at) => cause(at, 'infra'));
    const { points } = ReflectionNoticeWording.of(
      {
        outcome: 'no-config-cause',
        endedSearch: true,
        looked: 25,
        fixes: many,
      },
      'Build',
      TITLES,
    );

    expect(points).toHaveLength(20);
    expect(points[19]).toBe('The search page shows 7 more.');
  });

  it('always says what happened first, even with nothing for a person to fix', () => {
    for (const outcome of [
      'went-on',
      'no-config-cause',
      'no-failures',
      'did-not-run',
      'out-of-budget',
    ] as const) {
      const { points } = ReflectionNoticeWording.of(
        { outcome, endedSearch: outcome !== 'went-on', looked: 1, fixes: [] },
        'Build',
        TITLES,
      );

      expect(points).toHaveLength(1);
      expect(points[0]).toMatch(/^[A-Z].+\.$/);
    }
  });
});

describe('UnreflectedStallWording', () => {
  it('says the search stalled with no budget left to look into why', () => {
    expect(UnreflectedStallWording.of('Build')).toEqual({
      headline:
        'The search for a better Build config ended with no budget left to reflect',
      points: [
        'Two iterations in a row found nothing better. Please start a new search with more budget to find out why.',
      ],
    });
  });
});
