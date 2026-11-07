import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  LineDetail,
  LineReaderPort,
} from '@lines/application/ports/line-reader.port';
import { ListLinesHandler } from '@lines/application/queries/handlers/list-lines.handler';
import { ListLinesQuery } from '@lines/application/queries/list-lines.query';
import { describe, expect, it, vi } from 'vitest';

const LINE_SEARCH = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  period: '7d',
  onAlert: true,
  cooldown: '3d',
};

const bare = {
  color: '#a3a8b0',
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  judge: null,
  alerts: [],
  search: {
    ...LINE_SEARCH,
    agent: { harness: 'claude-code', model: null, effort: 'high' },
    iterations: 3,
    repeats: null,
    objective: 'cost',
  },
  kind: 'work' as const,
  skills: [],
};

const board: LineDetail = {
  id: 'line_1',
  key: 'default',
  name: 'Default',
  stations: [
    { id: 'station_1', key: 'triage', name: 'Triage', position: 0, ...bare },
    {
      id: 'station_2',
      key: 'spec',
      name: 'Spec',
      position: 1,
      ...bare,
      harness: 'dev',
    },
  ],
  reactions: [
    {
      happening: 'github.pull_request.commented',
      from: null,
      to: 'station_2',
    },
  ],
  repositories: [
    {
      fullName: 'acme/api',
      host: 'github',
      url: 'https://github.com/acme/api',
    },
  ],
  replayCheck: {
    maxRegressions: 0,
    ceiling: 10,
    currency: 'USD',
    minGain: 0.05,
  },
  source: { repository: 'acme/platform', path: 'teams/core.tf' },
  search: LINE_SEARCH,
};

const reader = (result: LineDetail[]): LineReaderPort => ({
  ofTeam: vi.fn().mockResolvedValue(result),
});

const access = (sees = true) =>
  ({
    inWorkspaceOfTeam: vi.fn().mockResolvedValue(sees ? {} : null),
  }) as unknown as WorkspaceAccessPort;

const handle = (lines: LineReaderPort, teamId = 'team_1', viewer = access()) =>
  new ListLinesHandler(viewer, lines).execute(
    new ListLinesQuery(teamId, 'user_1'),
  );

describe('ListLinesHandler', () => {
  it('hands back each line with its stations', async () => {
    await expect(handle(reader([board]))).resolves.toEqual([
      {
        id: 'line_1',
        key: 'default',
        name: 'Default',
        stations: [
          {
            id: 'station_1',
            key: 'triage',
            name: 'Triage',
            position: 0,
            ...bare,
          },
          {
            id: 'station_2',
            key: 'spec',
            name: 'Spec',
            position: 1,
            ...bare,
            harness: 'dev',
          },
        ],
        reactions: [
          {
            happening: 'github.pull_request.commented',
            from: null,
            to: 'station_2',
          },
        ],
        repositories: [
          {
            fullName: 'acme/api',
            host: 'github',
            url: 'https://github.com/acme/api',
          },
        ],
        replayCheck: {
          maxRegressions: 0,
          ceiling: 10,
          currency: 'USD',
          minGain: 0.05,
        },
        source: { repository: 'acme/platform', path: 'teams/core.tf' },
        search: LINE_SEARCH,
      },
    ]);
  });

  it('asks whether the caller sees the team before it reads', async () => {
    const viewer = access();

    await handle(reader([board]), 'team_1', viewer);

    expect(viewer.inWorkspaceOfTeam).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'team_1' }),
      expect.objectContaining({ value: 'user_1' }),
    );
  });

  it('answers nothing to a caller who does not see the team, and reads nothing', async () => {
    const lines = reader([board]);

    await expect(handle(lines, 'team_1', access(false))).resolves.toBeNull();
    expect(lines.ofTeam).not.toHaveBeenCalled();
  });

  it('reports an unusable team id as invalid input', async () => {
    await expect(handle(reader([board]), '  ')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});
