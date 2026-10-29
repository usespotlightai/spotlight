import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ReflectionNoticeWording } from '@replays/application/rendering/reflection-notice';
import { SearchResultWording } from '@replays/application/rendering/search-result-notice';
import {
  FailureCause,
  type FailureCauseKind,
} from '@replays/domain/value-objects/failure-cause.vo';
import { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const MOCK = readFileSync(
  resolve(__dirname, '../../../../../../web/src/mocks/world/inbox.ts'),
  'utf8',
);

const pointsOfMock = (id: string): readonly string[] => {
  const at = MOCK.indexOf(`id: ${id},`);
  const points = MOCK.slice(at).match(/points: \[([\s\S]*?)\],/)?.[1] ?? '';

  return [...points.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(
    (each) => each[1] ?? '',
  );
};

const STALLED = [
  {
    title: 'Reconcile open invoices after the retry drain',
    kind: 'check',
    suggestion:
      'The reconcile script needs the billing database, which the runner cannot reach.',
  },
  {
    title: 'Drain the stuck retry queues',
    kind: 'judge',
    suggestion:
      'It wants a test for every change, but this change has nothing to test.',
  },
  {
    title: 'Upgrade the Postgres driver',
    kind: 'task',
    suggestion:
      'Its migration rewrites 1.3M invoice rows, which no candidate finishes in time.',
  },
] as const satisfies readonly {
  title: string;
  kind: FailureCauseKind;
  suggestion: string;
}[];

describe('the notices the web mocks show', () => {
  it('words the stall advice as the server does for each cause', () => {
    const fixes = ReflectionNoticeWording.fixesOf(
      {
        result: 'no-config-cause',
        endedSearch: true,
        looked: STALLED.length,
        fixes: STALLED.map((each, at) =>
          FailureCause.of({
            task: ReflectedTask.of({
              taskId: TaskId.of(`task_${at}`),
              originalRunId: RunId.of(`original_${at}`),
              replayRunId: RunId.of(`replayed_${at}`),
            }),
            cause: each.kind,
            evidence: 'Evidence.',
            suggestion: each.suggestion,
            at: new Date('2026-10-01T09:00:00.000Z'),
          }),
        ),
      },
      new Map(STALLED.map((each, at) => [`original_${at}`, each.title])),
    );

    expect(pointsOfMock('STALLED_NOTICE_ID')).toEqual(fixes);
  });

  it('words the opened config pull request as the server does', () => {
    const { points } = SearchResultWording.opened({
      objective: 'success',
      stationName: 'Implementation',
      candidateName: 'tests-first',
      changes: ['prompt'],
      heldOutGain: 0.22,
      costPerRun: null,
      liveCostPerRun: null,
      currency: 'USD',
    });

    expect(pointsOfMock('PULL_REQUEST_NOTICE_ID')).toEqual(points);
  });
});
