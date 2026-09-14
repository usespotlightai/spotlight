import type {
  LineDetail,
  LineReaderPort,
} from '@application/ports/line-reader.port';
import { ListLinesHandler } from '@application/queries/handlers/list-lines.handler';
import { ListLinesQuery } from '@application/queries/list-lines.query';
import { describe, expect, it, vi } from 'vitest';

const bare = {
  color: '#a3a8b0',
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
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
  repositories: ['acme/api'],
};

const reader = (result: LineDetail[] | null): LineReaderPort => ({
  listForTeamMember: vi.fn().mockResolvedValue(result),
  stationFor: vi.fn().mockResolvedValue(null),
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
        repositories: ['acme/api'],
      },
    ]);
  });

  it('asks the reader on behalf of the caller, not the team alone', async () => {
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
      kind: 'invalid-input',
    });
  });
});
