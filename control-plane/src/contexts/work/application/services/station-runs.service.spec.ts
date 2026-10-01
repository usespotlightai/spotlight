import type {
  EndedRunRow,
  StationRunReaderPort,
} from '@work/application/ports/station-run-reader.port';
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

describe('StationRuns.ended', () => {
  it('names the harness, model, effort, profile and repositories the run was configured with', async () => {
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
            skills: [],
            tools: [],
            decisions: false,
            memories: false,
          },
        }),
      ),
    );

    expect(await stations.ended('run_1')).toEqual({
      runId: 'run_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      taskId: 'task_1',
      fingerprint: null,
      round: 2,
      harness: 'codex',
      model: 'gpt-5',
      effort: 'high',
      profileKey: 'careful',
      repositories: ['acme/api', 'acme/web'],
      queuedAt: QUEUED,
      startedAt: STARTED,
      endedAt: ENDED,
    });
  });

  it('falls back on the harness the run ran on when it recorded no config', async () => {
    const stations = new StationRuns(readingOnly(row()));

    expect(await stations.ended('run_1')).toMatchObject({
      harness: 'claude-code',
      model: null,
      effort: null,
      profileKey: null,
      repositories: [],
    });
  });
});
