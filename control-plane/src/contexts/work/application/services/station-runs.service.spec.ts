import type {
  EndedRunRow,
  StationRunReaderPort,
  UnfinishedRunRow,
} from '@work/application/ports/station-run-reader.port';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';
import { StationRuns } from '@work/application/services/station-runs.service';
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
  queuedAt: QUEUED,
  startedAt: STARTED,
  endedAt: ENDED,
  ...change,
});

const readingOnly = (found: EndedRunRow): StationRunReaderPort =>
  ({ endedRun: async () => found }) as unknown as StationRunReaderPort;

const NO_SKILLS: TeamSkillsPort = {
  definedFor: async () => [],
  readyFor: async () => [],
};

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
      NO_SKILLS,
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
    const stations = new StationRuns(readingOnly(row()), NO_SKILLS);

    expect(await stations.ended('run_1')).toMatchObject({
      harness: 'claude-code',
      model: null,
      effort: null,
      profileKey: null,
      repositories: [],
      skills: [],
    });
  });
});

describe('StationRuns.alertsAt', () => {
  it('names the thresholds a station watches, and nothing for a station it does not know', async () => {
    const alert = {
      measure: 'sent_back_rate',
      risesBy: 0.15,
      above: null,
      fallsBy: null,
      below: null,
      over: 10,
    };
    const stations = new StationRuns(
      {
        alertsAt: async (stationId: string) =>
          stationId === 'station_1' ? [alert] : null,
      } as unknown as StationRunReaderPort,
      NO_SKILLS,
    );

    expect(await stations.alertsAt('station_1')).toEqual([alert]);
    expect(await stations.alertsAt('station_9')).toBeNull();
  });
});

describe('StationRuns.teamSkillKeys', () => {
  it('names every skill the team defines', async () => {
    const stations = new StationRuns(readingOnly(row()), {
      ...NO_SKILLS,
      definedFor: async (teamId) =>
        teamId.value === 'team_1' ? ['grafana', 'our-migrations'] : [],
    });

    expect(await stations.teamSkillKeys('team_1')).toEqual([
      'grafana',
      'our-migrations',
    ]);
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
            state: 'waiting',
            stopRequested: true,
          }),
          unfinishedRow('run_waiting', { state: 'waiting' }),
        ],
      } as unknown as StationRunReaderPort,
      NO_SKILLS,
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
      NO_SKILLS,
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
