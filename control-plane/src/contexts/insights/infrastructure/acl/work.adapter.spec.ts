import { Work } from '@insights/infrastructure/acl/work.adapter';
import type {
  LogFields,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ChatRunsPort } from '@work/application/ports/chat-runs.port';
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
  runNumber: 1,
  harness: 'claude-code',
  model: null,
  effort: null,
  profileKey: null,
  repositories: [],
  skills: [],
  queuedAt: new Date('2026-09-30T09:00:00.000Z'),
  startedAt: new Date('2026-09-30T09:10:00.000Z'),
  endedAt: new Date('2026-09-30T10:00:00.000Z'),
  queuedMs: 600_000,
  runningMs: 1_200_000,
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
  const stations = partial<StationRunsPort>({
    ended: async () => endedRun(fingerprint),
  });

  return {
    work: new Work(stations, partial<ChatRunsPort>({}), logger),
    warned,
  };
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

  it('reads the time the run spent queued and running', async () => {
    const { work } = workOf(SHA_256);

    const run = await work.endedRun(RunId.of('run_1'));

    expect(run?.queuedMs).toBe(600_000);
    expect(run?.runningMs).toBe(1_200_000);
  });

  it('warns of nothing when a run ended with no config', async () => {
    const { work, warned } = workOf(null);

    const run = await work.endedRun(RunId.of('run_1'));

    expect(run?.fingerprint).toBe(null);
    expect(warned).toEqual([]);
  });
});

const CHAT_REQUESTER = {
  owner: 'work',
  kind: 'chat',
  id: 'chat_1',
  token: null,
};

describe('reading a chat run from Work', () => {
  it('reads the chat a run worked for, and the team it is in', async () => {
    const work = new Work(
      partial<StationRunsPort>({}),
      partial<ChatRunsPort>({
        of: async (runId) => ({
          runId,
          workspaceId: 'ws_1',
          teamId: 'team_1',
          chatId: 'chat_1',
          harness: 'claude-code',
          model: null,
          repositories: ['acme/api'],
        }),
      }),
      partial<LoggerPort>({}),
    );

    const run = await work.chatRunOf(RunId.of('run_1'), CHAT_REQUESTER);

    expect(run?.teamId.value).toBe('team_1');
    expect(run).toMatchObject({
      chatId: 'chat_1',
      harness: 'claude-code',
      model: null,
      repositories: ['acme/api'],
    });
  });

  it('reads no chat for a run of none', async () => {
    const work = new Work(
      partial<StationRunsPort>({}),
      partial<ChatRunsPort>({ of: async () => null }),
      partial<LoggerPort>({}),
    );

    expect(await work.chatRunOf(RunId.of('run_1'), CHAT_REQUESTER)).toBeNull();
  });
});
