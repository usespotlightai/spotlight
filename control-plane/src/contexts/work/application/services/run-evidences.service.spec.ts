import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  JournalStep,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type { BriefedTasksPort } from '@work/application/ports/briefed-tasks.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { RunEvidences } from '@work/application/services/run-evidences.service';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const stepOf = (change: Partial<JournalStep>): JournalStep => ({
  kind: 'said',
  text: '',
  status: null,
  tool: null,
  detail: null,
  ms: 0,
  startedAt: new Date('2026-09-30T10:00:00.000Z'),
  locations: [],
  given: null,
  returned: null,
  change: null,
  ...change,
});

const journal: RunJournal = {
  runId: 'run_1',
  attempt: 1,
  steps: [
    stepOf({ kind: 'thought', text: 'Retry in the request.' }),
    stepOf({
      kind: 'tool',
      tool: 'edit',
      text: 'src/uploads.ts',
      given: 'x'.repeat(5_000),
      change: {
        path: '/workspace/api/src/uploads.ts',
        before: 'a\nb\nc\n',
        after: 'a\nB\nc\n',
      },
    }),
    stepOf({
      kind: 'tool',
      tool: 'edit',
      text: 'src/uploads.ts',
      change: {
        path: '/workspace/api/src/uploads.ts',
        before: 'a\nB\nc\n',
        after: 'a\nB\nc\nd\n',
      },
    }),
  ],
  spans: [],
  ms: null,
  marks: {
    startedAt: null,
    readyAt: null,
    spokeFrom: null,
    spokeTo: null,
    endedAt: null,
  },
  spent: null,
  egressEnforcement: null,
};

const TASK_RUN = {
  id: RunId.of('run_1'),
  taskId: TaskId.of('task_1'),
  replayOf: null,
  spec: { checkoutFolders: ['api'] },
};

const REPLAY = {
  id: RunId.of('replay_1'),
  taskId: null,
  replayOf: RunId.of('run_1'),
  spec: { checkoutFolders: ['api'] },
};

const evidences = (judge: StationJudge | null = null) =>
  new RunEvidences(
    {
      findById: async (id: RunId) =>
        [TASK_RUN, REPLAY].find((each) => each.id.equals(id)) ?? null,
    } as unknown as RunRepository,
    {
      find: async () => ({
        id: TaskId.of('task_1'),
        title: TaskTitle.of('Retry uploads'),
        description: TaskDescription.of('They fail on a flaky network.'),
      }),
    } as unknown as TaskRepository,
    {
      findByStation: async () => ({
        teamId: TeamId.of('team_1'),
        id: { value: 'line_1' },
        stationAt: () => ({ judge }),
      }),
      ofTeam: async (teamId: TeamId) => [
        {
          teamId,
          id: { value: 'line_1' },
          stations: [
            { id: { value: 'station_1' }, judge },
            { id: { value: 'station_2' }, judge: null },
          ],
        },
        {
          teamId,
          id: { value: 'line_2' },
          stations: [{ id: { value: 'station_3' }, judge }],
        },
      ],
    } as unknown as LineRepository,
    {
      attemptsOfRun: async () => [
        { ...journal, steps: journal.steps.slice(0, 2) },
        { ...journal, attempt: 2, steps: journal.steps.slice(2) },
      ],
    } as unknown as RunJournalReaderPort,
    {
      of: async (runId: RunId) =>
        runId.equals(TASK_RUN.id)
          ? {
              title: 'Retry uploads, as briefed',
              description: 'They failed then.',
            }
          : null,
    } as unknown as BriefedTasksPort,
    { sha256: (text: string) => `sha of ${text}` },
  );

describe('RunEvidences', () => {
  it('lays out the run’s steps by their place across its attempts, as the Run page shows them, clipping long outputs', async () => {
    const evidence = await evidences().of('run_1');

    expect(evidence?.title).toBe('Retry uploads');
    expect(evidence?.description).toBe('They fail on a flaky network.');
    expect(evidence?.steps.map((each) => each.index)).toEqual([0, 1, 2]);
    expect(evidence?.steps[1]?.given?.length).toBeLessThan(2_100);
    expect(evidence?.steps[1]?.tool).toBe('edit');
  });

  it('tells a replay by the task its original was briefed with, and by its own steps and changes', async () => {
    const evidence = await evidences().of('replay_1');

    expect(evidence).toMatchObject({
      runId: 'replay_1',
      taskId: 'task_1',
      title: 'Retry uploads, as briefed',
      description: 'They failed then.',
    });
    expect(evidence?.hunks.map((each) => each.id)).toEqual([
      'api/src/uploads.ts#1',
    ]);
  });

  it('cuts the run’s file changes into hunks named by path and place', async () => {
    const evidence = await evidences().of('run_1');

    expect(evidence?.hunks).toEqual([
      {
        id: 'api/src/uploads.ts#1',
        path: 'api/src/uploads.ts',
        index: 1,
        header: '@@ -1,3 +1,4 @@',
        lines: [' a', '-b', '+B', ' c', '+d'],
      },
    ]);
  });

  it('versions the station’s judge by the digest of its rubric, claims and pass share together', async () => {
    const judge = await evidences(
      StationJudge.of({ rubric: 'Did it retry?', sample: 0.5, trust: 0.6 }),
    ).judgeAt('station_1');

    expect(judge).toEqual({
      teamId: 'team_1',
      lineId: 'line_1',
      rubric: 'Did it retry?',
      claims: [],
      passShare: 1,
      rubricVersion: `sha of ${JSON.stringify({ rubric: 'Did it retry?', claims: [], passShare: 1 })}`,
      sample: 0.5,
      trust: 0.6,
    });
  });

  it('gives a judge of claims alone, with the share of them a run must meet', async () => {
    const judge = await evidences(
      StationJudge.of({
        claims: ['It retries.', 'It adds a test.'],
        passShare: 0.5,
        sample: 0.5,
        trust: 0.6,
      }),
    ).judgeAt('station_1');

    expect(judge).toMatchObject({
      rubric: null,
      claims: ['It retries.', 'It adds a test.'],
      passShare: 0.5,
    });
    expect(judge?.rubricVersion).not.toBe(
      (
        await evidences(
          StationJudge.of({
            claims: ['It retries.', 'It adds a test.'],
            passShare: 1,
            sample: 0.5,
            trust: 0.6,
          }),
        ).judgeAt('station_1')
      )?.rubricVersion,
    );
  });

  it('gives the judges of a team’s stations on every line as the station gives each one', async () => {
    const reader = evidences(
      StationJudge.of({ rubric: 'Did it retry?', sample: 0.5, trust: 0.6 }),
    );
    const judge = await reader.judgeAt('station_1');

    expect(await reader.judgesOnTeam('team_1')).toEqual(
      new Map([
        ['station_1', judge],
        ['station_3', judge && { ...judge, lineId: 'line_2' }],
      ]),
    );
  });

  it('says a station without a judge has none', async () => {
    expect(await evidences().judgeAt('station_1')).toBeNull();
  });

  it('says a run has a task while its task is still there', async () => {
    expect(await evidences().hasTask('run_1')).toBe(true);
  });
});
