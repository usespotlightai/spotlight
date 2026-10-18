import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunConfigSummary,
  RunConfigView,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import { ReadRunConfigHandler } from '@work/application/queries/handlers/read-run-config.handler';
import { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { describe, expect, it, vi } from 'vitest';

const PARTS: StationConfigParts = {
  prompt: 'Implement it.',
  harness: 'claude-code',
  model: null,
  effort: 'high',
  profile: null,
  image: null,
  repositories: [],
  skills: [],
  tools: [],
  decisions: false,
  memories: false,
};

const configured = (
  runId: string,
  fingerprint: string,
  parts: Partial<StationConfigParts> = {},
): RunConfigView => ({
  runId,
  taskId: `task_of_${runId}`,
  fingerprint: fingerprint.repeat(64),
  parts: { ...PARTS, ...parts },
});

const readerOf = (teamId: string | null) =>
  ({
    permissionsAsTeamReader: vi
      .fn()
      .mockResolvedValue(
        teamId
          ? { teamId: TeamId.of(teamId), workspaceId: WorkspaceId.of('ws_1') }
          : null,
      ),
  }) as unknown as WorkspaceAccessPort;

const reading = (
  found: RunConfigSummary | null,
  access: WorkspaceAccessPort = readerOf('team_1'),
) =>
  new ReadRunConfigHandler(access, {
    listForTask: vi.fn(),
    listForTeam: vi.fn(),
    conversationFor: vi.fn(),
    configFor: vi.fn().mockResolvedValue(found),
    replayFor: vi.fn(),
    searchRunFor: vi.fn(),
  } satisfies RunReaderPort).execute(
    new ReadRunConfigQuery('team_1', 'run_2', 'user_1'),
  );

describe('ReadRunConfigHandler', () => {
  it('shows a replay run’s config only to those who may read its team’s insights', async () => {
    const replayed = (teamId: string | null): RunConfigSummary => ({
      ran: null,
      before: null,
      ranForTeam: { workspaceId: 'ws_1', teamId },
    });

    expect(await reading(replayed('team_1'))).toEqual({
      fingerprint: null,
      config: null,
      changedSince: null,
    });
    expect(await reading(replayed('team_1'), readerOf(null))).toBeNull();
    expect(await reading(replayed('team_2'))).toBeNull();
  });

  it('finds nothing for a run the viewer cannot see', async () => {
    expect(await reading(null)).toBeNull();
  });

  it('answers no config for a run that recorded none', async () => {
    expect(
      await reading({ ran: null, before: null, ranForTeam: null }),
    ).toEqual({
      fingerprint: null,
      config: null,
      changedSince: null,
    });
  });

  it('names the station’s run before, and what changed, when that run ran another config', async () => {
    const found = await reading({
      ran: configured('run_2', 'b', { effort: 'xhigh' }),
      before: configured('run_1', 'a'),
      ranForTeam: null,
    });

    expect(found?.fingerprint).toBe('b'.repeat(64));
    expect(found?.changedSince).toEqual({
      runId: 'run_1',
      taskId: 'task_of_run_1',
      fingerprint: 'a'.repeat(64),
      changes: [
        {
          part: 'effort',
          name: null,
          kind: 'changed',
          was: 'high',
          now: 'xhigh',
        },
      ],
    });
  });

  it('names no run before when the station ran the same config then', async () => {
    const found = await reading({
      ran: configured('run_2', 'a'),
      before: configured('run_1', 'a'),
      ranForTeam: null,
    });

    expect(found?.changedSince).toBeNull();
  });
});
