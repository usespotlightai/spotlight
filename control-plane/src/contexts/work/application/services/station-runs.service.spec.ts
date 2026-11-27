import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type {
  EndedRunRow,
  StationRunReaderPort,
  UnfinishedRunRow,
} from '@work/application/ports/station-run-reader.port';
import type { EndedStationRun } from '@work/application/ports/station-runs.port';
import { StationRuns } from '@work/application/services/station-runs.service';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import {
  deliveryLineOf,
  repositoryOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
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
  queuedMs: 120_000,
  runningMs: 300_000,
  ...change,
});

const NO_DISPATCHES: DispatchRepository = {
  add: async () => {},
  save: async () => {},
  find: async () => null,
};

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

let ids = 0;

const LINE = deliveryLineOf({
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  newId: () => `id_${(ids += 1)}`,
  repositories: [repositoryOf(API), repositoryOf(WEB)],
});

const LINES = partial<LineMapsPort>({ find: async () => LINE });

const NO_LINES = partial<LineMapsPort>({ find: async () => null });

const readingOnly = (found: EndedRunRow): StationRunReaderPort =>
  partial<StationRunReaderPort>({
    endedRun: async () => found,
  });

const configured = (
  repositories: StationConfigParts['repositories'],
): StationConfigParts => ({
  prompt: null,
  harness: 'claude-code',
  model: null,
  effort: null,
  profile: null,
  image: null,
  repositories,
  skills: [],
  tools: [],
  decisions: false,
  memories: false,
});

const names = (run: EndedStationRun | null) =>
  run?.repositories.map((each) => each.value);

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
              { name: 'api', setup: null },
              { name: 'web', setup: 'npm ci' },
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
      LINES,
    );

    expect(await stations.ended('run_1')).toEqual({
      runId: 'run_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      taskId: 'task_1',
      fingerprint: null,
      runNumber: 2,
      harness: 'codex',
      model: 'gpt-5',
      effort: 'high',
      profileKey: 'careful',
      repositories: [API, WEB],
      skills: ['grafana', 'our-migrations'],
      queuedAt: QUEUED,
      startedAt: STARTED,
      endedAt: ENDED,
      queuedMs: 120_000,
      runningMs: 300_000,
    });
  });

  it('falls back on the harness the run ran on when it recorded no config', async () => {
    const stations = new StationRuns(readingOnly(row()), NO_DISPATCHES, LINES);

    expect(await stations.ended('run_1')).toMatchObject({
      harness: 'claude-code',
      model: null,
      effort: null,
      profileKey: null,
      repositories: [],
      skills: [],
    });
  });

  it('names each repository a task run worked on by its owner and name, though its config names it by name alone', async () => {
    const stations = new StationRuns(
      readingOnly(
        row({
          config: configured([
            { name: 'api', setup: null },
            { name: 'web', setup: null },
          ]),
        }),
      ),
      NO_DISPATCHES,
      LINES,
    );

    expect(names(await stations.ended('run_1'))).toEqual([
      'acme/api',
      'acme/web',
    ]);
  });

  it('names a repository the same way for a run that reviewed it and a run that worked on it', async () => {
    const working = new StationRuns(
      readingOnly(row({ config: configured([{ name: 'api', setup: null }]) })),
      NO_DISPATCHES,
      LINES,
    );
    const reviewing = new StationRuns(
      readingOnly(
        row({
          reviewing: 'acme/api',
          config: configured([{ name: 'api', setup: null }]),
        }),
      ),
      NO_DISPATCHES,
      LINES,
    );

    expect(names(await working.ended('run_1'))).toEqual(['acme/api']);
    expect(names(await reviewing.ended('run_1'))).toEqual(['acme/api']);
  });

  it('spells a repository as its line does, whatever case the run named it in', async () => {
    const stations = new StationRuns(
      readingOnly(
        row({
          reviewing: 'Acme/API',
          config: configured([{ name: 'acme/api', setup: null }]),
        }),
      ),
      NO_DISPATCHES,
      LINES,
    );
    const configuredInFull = new StationRuns(
      readingOnly(
        row({ config: configured([{ name: 'ACME/web', setup: null }]) }),
      ),
      NO_DISPATCHES,
      LINES,
    );

    expect(names(await stations.ended('run_1'))).toEqual(['acme/api']);
    expect(names(await configuredInFull.ended('run_1'))).toEqual(['acme/web']);
  });

  it('names no repository the line no longer has, as it cannot tell its owner', async () => {
    const stations = new StationRuns(
      readingOnly(
        row({
          config: configured([
            { name: 'api', setup: null },
            { name: 'gone', setup: null },
          ]),
        }),
      ),
      NO_DISPATCHES,
      LINES,
    );

    expect(names(await stations.ended('run_1'))).toEqual(['acme/api']);
  });

  it('names only the repository under review when the run reviewed a pull request', async () => {
    const stations = new StationRuns(
      readingOnly(
        row({
          reviewing: 'acme/web',
          config: configured([
            { name: 'api', setup: null },
            { name: 'web', setup: null },
          ]),
        }),
      ),
      NO_DISPATCHES,
      LINES,
    );

    expect(names(await stations.ended('run_1'))).toEqual(['acme/web']);
  });

  it('names the repository under review on a line that declares none', async () => {
    const stations = new StationRuns(
      readingOnly(row({ reviewing: 'acme/web' })),
      NO_DISPATCHES,
      NO_LINES,
    );

    expect(names(await stations.ended('run_1'))).toEqual(['acme/web']);
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
  progress: 'queued',
  queuedAt: QUEUED,
  startedAt: null,
  ...change,
});

describe('StationRuns.unfinished', () => {
  it('gives each unfinished run its progress, and leaves out runs that wait for a person', async () => {
    const stations = new StationRuns(
      partial<StationRunReaderPort>({
        unfinishedOfTeam: async () => [
          unfinishedRow('run_queued'),
          unfinishedRow('run_claimed', {
            progress: 'in-progress',
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
          unfinishedRow('run_stopping', { progress: 'stopping' }),
          unfinishedRow('run_suspended', { progress: null }),
        ],
      }),
      NO_DISPATCHES,
      NO_LINES,
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
      partial<StationRunReaderPort>({
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
      }),
      NO_DISPATCHES,
      NO_LINES,
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
        order: runOrderOf(RunId.of('run_1')),
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
        driver: 'line' as const,
      }),
      NO_LINES,
    );

    expect(await stations.taskRunOf('run_1')).toEqual({
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      teamId: 'team_1',
    });
  });

  it('names no task for a chat run or a run Work did not order', async () => {
    const chat = new StationRuns(
      readingOnly(row()),
      dispatched({ kind: 'chat', chatId: ChatId.of('chat_1') }),
      NO_LINES,
    );
    const unordered = new StationRuns(
      readingOnly(row()),
      NO_DISPATCHES,
      NO_LINES,
    );

    expect(await chat.taskRunOf('run_1')).toBeNull();
    expect(await unordered.taskRunOf('run_1')).toBeNull();
  });
});
