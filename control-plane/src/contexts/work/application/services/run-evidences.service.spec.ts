import type {
  JournalStep,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import { runJournalReadings } from '@runs/application/ports/run-journal-readings.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { RunEvidences } from '@work/application/services/run-evidences.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import {
  runOrderOf,
  trialOrderOf,
} from '@work/domain/value-objects/dispatch-order.fake-spec';
import type { DispatchSubject } from '@work/domain/value-objects/dispatch-subject.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const stepOf = (change: Partial<JournalStep>): JournalStep => ({
  kind: 'message',
  text: '',
  status: null,
  tool: null,
  detail: null,
  ms: 0,
  startedAt: new Date('2026-09-30T10:00:00.000Z'),
  locations: [],
  input: null,
  output: null,
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
      input: 'x'.repeat(5_000),
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
    firstAgentUpdateAt: null,
    lastAgentUpdateAt: null,
    agentStoppedAt: null,
    endedAt: null,
  },
  spent: null,
  egressEnforcement: null,
};

const TASK_RUN = { runId: RunId.of('run_1'), checkouts: ['api'] };

const REPLAY = { runId: RunId.of('replay_1'), checkouts: ['api'] };

const BRIEFED = BriefedTask.of({
  stationId: StationId.of('station_1'),
  title: 'Retry uploads, as briefed',
  description: 'They failed then.',
  reviewing: null,
  attachments: [],
  notes: [],
  openReviewComments: [],
});

const CONFIG = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

const dispatchOf = (id: RunId, subject: DispatchSubject): Dispatch =>
  Dispatch.trialOrdered({
    id,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: null,
    subject,
    configuredAs: CONFIG,
    briefedTask: BRIEFED,
    order: trialOrderOf(id),
    now: new Date('2026-09-30T09:00:00.000Z'),
  });

const DISPATCHES = new Map<string, Dispatch>([
  [
    'run_1',
    Dispatch.ordered({
      id: TASK_RUN.runId,
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: null,
      subject: {
        kind: 'task',
        taskId: TaskId.of('task_1'),
        revision: TaskRevision.of(0),
        stationId: StationId.of('station_1'),
      },
      configuredAs: null,
      briefedTask: BRIEFED,
      order: runOrderOf(TASK_RUN.runId),
      now: new Date('2026-09-30T09:00:00.000Z'),
    }),
  ],
  [
    'replay_1',
    dispatchOf(REPLAY.runId, {
      kind: 'trial',
      basedOn: TASK_RUN.runId,
      taskId: TaskId.of('task_1'),
      stationId: StationId.of('station_1'),
      asOf: null,
      repositories: [],
      followUp: null,
    }),
  ],
]);

const evidences = () =>
  new RunEvidences(
    {
      of: async ([id]: readonly RunId[]) =>
        [TASK_RUN, REPLAY].filter((each) => id && each.runId.equals(id)),
    } as unknown as RunFactsPort,
    {
      find: async () => ({
        id: TaskId.of('task_1'),
        title: TaskTitle.of('Retry uploads'),
        description: TaskDescription.of('They fail on a flaky network.'),
      }),
    } as unknown as TaskRepository,
    {
      attemptsOfRun: async () => [
        { ...journal, steps: journal.steps.slice(0, 2) },
        { ...journal, attempt: 2, steps: journal.steps.slice(2) },
      ],
    } as unknown as RunJournalReaderPort,
    {
      find: async (id: RunId) => DISPATCHES.get(id.value) ?? null,
    } as unknown as DispatchRepository,
    runJournalReadings(),
  );

describe('RunEvidences', () => {
  it('lays out the run’s steps by their place across its attempts, as the Run page shows them, clipping long outputs', async () => {
    const evidence = await evidences().of('run_1');

    expect(evidence?.title).toBe('Retry uploads');
    expect(evidence?.description).toBe('They fail on a flaky network.');
    expect(evidence?.steps.map((each) => each.index)).toEqual([0, 1, 2]);
    expect(evidence?.steps[1]?.input?.length).toBeLessThan(2_100);
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
});
