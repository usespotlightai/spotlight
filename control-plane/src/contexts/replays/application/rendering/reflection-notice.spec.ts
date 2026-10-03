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
    const said = ReflectionNoticeWording.of(
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

    expect(said.headline).toBe(
      'The search for a better Build config stalled: nothing left the config can fix',
    );
    expect(said.points).toEqual([
      'Two iterations in a row found nothing better, so its agent looked into the 2 tasks the best config so far still fails, and found none a change to the config could fix. The search ended, keeping what it did not spend.',
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
      'The search for a better station config goes on, but found failures outside the config',
    );
    expect(headline('no-failures')).toBe(
      'The search for a better station config stalled: its best config already passes every task it searches, so there was nothing to look into',
    );
    expect(headline('did-not-run')).toBe(
      'The search for a better station config stalled, and looking into why could not run',
    );
    expect(headline('out-of-budget')).toBe(
      'The search for a better station config ran out of budget: it found what the config could fix, but could not try it',
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
    expect(points[19]).toBe('7 more on the search’s page');
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
      expect(points[0]).toMatch(
        /^Two iterations in a row found nothing better/,
      );
    }
  });
});

describe('UnreflectedStallWording', () => {
  it('says the search stalled with no budget left to look into why', () => {
    expect(UnreflectedStallWording.of('Build')).toEqual({
      headline:
        'The search for a better Build config stalled, with no budget left to look into why',
      points: [
        'Two iterations in a row found nothing better, and the search had no budget left for its agent to look into why the remaining tasks fail, so it ended. Start a new search with more budget to find out.',
      ],
    });
  });
});
