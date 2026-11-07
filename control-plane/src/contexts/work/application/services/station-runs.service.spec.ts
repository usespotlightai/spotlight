import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  EndedRunRow,
  StationRunReaderPort,
  UnfinishedRunRow,
} from '@work/application/ports/station-run-reader.port';
import { StationRuns } from '@work/application/services/station-runs.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const QUEUED = new Date('2026-09-30T09:00:00.000Z');
const STARTED = new Date('2026-09-30T09:02:00.000Z');
const ENDED = new Date('2026-09-30T09:10:00.000Z');

const row = (change: Partial<EndedRunRow> = {}): EndedRunRow => ({
  runId: 'run_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint: null,
  earlier: ['completed'],
  harness: 'claude-code',
  config: null,
  reviewing: null,
  queuedAt: QUEUED,
  startedAt: STARTED,
  endedAt: ENDED,
  ...change,
});

const NO_DISPATCHES: DispatchRepository = {
  add: async () => {},
  save: async () => {},
  find: async () => null,
};

const readingOnly = (found: EndedRunRow): StationRunReaderPort =>
  ({ endedRun: async () => found }) as unknown as StationRunReaderPort;

describe('StationRuns.ended', () => {
  it('names the harness, model, effort, profile, repositories and skills the run was configured with', async () => {
    const stations = new StationRuns(
      readingOnly(
        row({
          config: {
            prompt: null,
            harness: 'codex',
            model: 'gpt-5',
            effort: 'high',
            profile: { key: 'careful', settings: {} },
            image: null,
            repositories: [
              { name: 'acme/api', setup: null },
              { name: 'acme/web', setup: 'npm ci' },
            ],
            skills: [
              { key: 'grafana', hash: 'd'.repeat(64) },
              { key: 'our-migrations', hash: 'e'.repeat(64) },
            ],
            tools: [],
            decisions: false,
            memories: false,
          },
        }),
      ),
      NO_DISPATCHES,
    );

    expect(await stations.ended('run_1')).toEqual({
      runId: 'run_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      taskId: 'task_1',
      fingerprint: null,
      visit: 2,
      harness: 'codex',
      model: 'gpt-5',
      effort: 'high',
      profileKey: 'careful',
      repositories: ['acme/api', 'acme/web'],
      skills: ['grafana', 'our-migrations'],
      queuedAt: QUEUED,
      startedAt: STARTED,
      endedAt: ENDED,
    });
  });

  it('falls back on the harness the run ran on when it recorded no config', async () => {
    const stations = new StationRuns(readingOnly(row()), NO_DISPATCHES);

    expect(await stations.ended('run_1')).toMatchObject({
      harness: 'claude-code',
      model: null,
      effort: null,
      profileKey: null,
      repositories: [],
      skills: [],
    });
  });

  it('names only the repository under review when the run reviewed a pull request', async () => {
    const stations = new StationRuns(
      readingOnly(
        row({
          reviewing: 'acme/web',
          config: {
            prompt: null,
            harness: 'claude-code',
            model: null,
            effort: null,
            profile: null,
            image: null,
            repositories: [
              { name: 'acme/api', setup: null },
              { name: 'acme/web', setup: null },
            ],
            skills: [],
            tools: [],
            decisions: false,
            memories: false,
          },
        }),
      ),
      NO_DISPATCHES,
    );

    expect(await stations.ended('run_1')).toMatchObject({
      repositories: ['acme/web'],
    });
  });

  it('names the repository under review on a line that declares none', async () => {
    const stations = new StationRuns(
      readingOnly(row({ reviewing: 'acme/web' })),
      NO_DISPATCHES,
    );

    expect(await stations.ended('run_1')).toMatchObject({
      repositories: ['acme/web'],
    });
  });
});

const unfinishedRow = (
  runId: string,
  change: Partial<UnfinishedRunRow> = {},
): UnfinishedRunRow => ({
  runId,
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  openedBy: 'user_ada',
  harness: 'claude-code',
  config: null,
  state: 'queued',
  stopRequested: false,
  queuedAt: QUEUED,
  startedAt: null,
  ...change,
});

describe('StationRuns.unfinished', () => {
  it('gives each unfinished run its progress, and leaves out runs that wait for a person', async () => {
    const stations = new StationRuns(
      {
        unfinishedOfTeam: async () => [
          unfinishedRow('run_queued'),
          unfinishedRow('run_claimed', {
            state: 'claimed',
            startedAt: STARTED,
            config: {
              prompt: null,
              harness: 'codex',
              model: 'gpt-5',
              effort: null,
              profile: null,
              image: null,
              repositories: [],
              skills: [],
              tools: [],
              decisions: false,
              memories: false,
            },
          }),
          unfinishedRow('run_stopping', {
            state: 'claimed',
            stopRequested: true,
          }),
          unfinishedRow('run_suspended', { state: 'suspended' }),
        ],
      } as unknown as StationRunReaderPort,
      NO_DISPATCHES,
    );

    expect(
      (await stations.unfinished('team_1')).map((each) => [
        each.runId,
        each.progress,
        each.harness,
        each.model,
      ]),
    ).toEqual([
      ['run_queued', 'queued', 'claude-code', null],
      ['run_claimed', 'in-progress', 'codex', 'gpt-5'],
      ['run_stopping', 'stopping', 'claude-code', null],
    ]);
  });
});

describe('StationRuns.traced', () => {
  it('shortens what a task asks and what a run wrote, and leaves out empty notes', async () => {
    const stations = new StationRuns(
      {
        traced: async () => ({
          tasks: [
            {
              taskId: 'task_1',
              title: 'Fix the queue',
              description: `  ${'a'.repeat(400)}  `,
              stationId: 'station_1',
            },
            {
              taskId: 'task_2',
              title: 'Tidy up',
              description: '   ',
              stationId: 'station_1',
            },
          ],
          stations: [
            {
              stationId: 'station_1',
              name: 'Implementation',
              color: '#edc12b',
              position: 0,
              stations: 3,
            },
          ],
          notes: new Map([
            ['run_1', ' Done '],
            ['run_2', '  '],
          ]),
        }),
      } as unknown as StationRunReaderPort,
      NO_DISPATCHES,
    );

    const traced = await stations.traced({
      taskIds: ['task_1', 'task_2'],
      runIds: ['run_1', 'run_2'],
      stationIds: ['station_1'],
    });

    expect(traced.tasks.map((each) => each.input?.length ?? null)).toEqual([
      300,
      null,
    ]);
    expect(traced.stations).toEqual([
      {
        stationId: 'station_1',
        name: 'Implementation',
        color: '#edc12b',
        position: 0,
        count: 3,
      },
    ]);
    expect([...traced.outputs]).toEqual([['run_1', 'Done']]);
  });
});

describe('StationRuns.taskRunOf', () => {
  const dispatched = (
    subject: Parameters<typeof Dispatch.ordered>[0]['subject'],
  ): DispatchRepository => ({
    ...NO_DISPATCHES,
    find: async () =>
      Dispatch.ordered({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        subject,
        configuredAs: null,
        order: DispatchOrder.of({}),
        now: QUEUED,
      }),
  });

  it('names the task and team of a run ordered for a task', async () => {
    const stations = new StationRuns(
      readingOnly(row()),
      dispatched({
        kind: 'task',
        taskId: TaskId.of('task_1'),
        revision: TaskRevision.of(0),
        stationId: StationId.of('station_1'),
      }),
    );

    expect(await stations.taskRunOf('run_1')).toEqual({
      runId: 'run_1',
      taskId: 'task_1',
      teamId: 'team_1',
    });
  });

  it('names no task for a chat run or a run Work did not order', async () => {
    const chat = new StationRuns(
      readingOnly(row()),
      dispatched({ kind: 'chat', chatId: ChatId.of('chat_1') }),
    );
    const unordered = new StationRuns(readingOnly(row()), NO_DISPATCHES);

    expect(await chat.taskRunOf('run_1')).toBeNull();
    expect(await unordered.taskRunOf('run_1')).toBeNull();
  });
});
