import type {
  LineDetail,
  LineReaderPort,
} from '@work/application/ports/line-reader.port';
import { ListLinesHandler } from '@work/application/queries/handlers/list-lines.handler';
import { ListLinesQuery } from '@work/application/queries/list-lines.query';
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

const reader = (result: LineDetail[] | null): LineReaderPort => ({
  listForTeamMember: vi.fn().mockResolvedValue(result),
});

const handle = (lines: LineReaderPort, teamId = 'team_1') =>
  new ListLinesHandler(lines).execute(new ListLinesQuery(teamId, 'user_1'));

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

  it('calls the reader on behalf of the caller, not the team alone', async () => {
    const lines = reader([board]);

    await handle(lines);

    expect(lines.listForTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'team_1' }),
      expect.objectContaining({ value: 'user_1' }),
    );
  });

  it('passes absence through, so the caller can answer not found', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });

  it('reports an unusable team id as invalid input', async () => {
    await expect(handle(reader([board]), '  ')).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});
