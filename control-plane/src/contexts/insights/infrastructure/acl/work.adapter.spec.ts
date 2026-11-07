import { Work } from '@insights/infrastructure/acl/work.adapter';
import type {
  LogFields,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  EndedStationRun,
  StationRunsPort,
} from '@work/application/ports/station-runs.port';
import { describe, expect, it } from 'vitest';

const SHA_256 = 'a'.repeat(64);

const endedRun = (fingerprint: string | null): EndedStationRun => ({
  runId: 'run_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  taskId: 'task_1',
  fingerprint,
  visit: 1,
  harness: 'claude-code',
  model: null,
  effort: null,
  profileKey: null,
  repositories: [],
  skills: [],
  queuedAt: new Date('2026-09-30T09:00:00.000Z'),
  startedAt: null,
  endedAt: new Date('2026-09-30T10:00:00.000Z'),
});

const workOf = (fingerprint: string | null) => {
  const warned: { fields: LogFields; message: string }[] = [];
  const logger: LoggerPort = {
    debug: () => {},
    info: () => {},
    warn: (fields, message) => {
      warned.push({ fields, message });
    },
    error: () => {},
  };
  const stations = {
    ended: async () => endedRun(fingerprint),
  } as unknown as StationRunsPort;

  return { work: new Work(stations, logger), warned };
};

describe('reading an ended run from Work', () => {
  it('reads a SHA-256 fingerprint as the config it ran', async () => {
    const { work, warned } = workOf(SHA_256);

    const run = await work.endedRun(RunId.of('run_1'));

    expect(run?.fingerprint).toBe(SHA_256);
    expect(warned).toEqual([]);
  });

  it('reads a fingerprint that is not a SHA-256 as no config, and warns of it', async () => {
    const { work, warned } = workOf('not-a-sha-256');

    const run = await work.endedRun(RunId.of('run_1'));

    expect(run?.fingerprint).toBe(null);
    expect(warned).toEqual([
      {
        fields: {
          runId: 'run_1',
          stationId: 'station_1',
          fingerprint: 'not-a-sha-256',
        },
        message:
          'Run ended with a malformed config fingerprint, recorded as no config',
      },
    ]);
  });

  it('warns of nothing when a run ended with no config', async () => {
    const { work, warned } = workOf(null);

    const run = await work.endedRun(RunId.of('run_1'));

    expect(run?.fingerprint).toBe(null);
    expect(warned).toEqual([]);
  });
});
