import type {
  AssemblyLineDetail,
  AssemblyLineReaderPort,
} from '@application/ports/assembly-line-reader.port';
import { ListAssemblyLinesHandler } from '@application/queries/handlers/list-assembly-lines.handler';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import { describe, expect, it, vi } from 'vitest';

const bare = {
  color: '#a3a8b0',
  description: null,
  harness: null,
  agentPrompt: null,
  kind: 'work' as const,
};

const board: AssemblyLineDetail = {
  id: 'line_1',
  name: 'Default',
  stations: [
    { id: 'station_1', name: 'Triage', position: 0, ...bare },
    { id: 'station_2', name: 'Spec', position: 1, ...bare, harness: 'dev' },
  ],
  reactions: [
    {
      happening: 'github.pull_request.commented',
      from: null,
      to: 'station_2',
    },
  ],
};

const reader = (
  result: AssemblyLineDetail[] | null,
): AssemblyLineReaderPort => ({
  listForTeamMember: vi.fn().mockResolvedValue(result),
});

const handle = (lines: AssemblyLineReaderPort, teamId = 'team_1') =>
  new ListAssemblyLinesHandler(lines).execute(
    new ListAssemblyLinesQuery(teamId, 'user_1'),
  );

describe('ListAssemblyLinesHandler', () => {
  it('hands back each line with its stations', async () => {
    await expect(handle(reader([board]))).resolves.toEqual([
      {
        id: 'line_1',
        name: 'Default',
        stations: [
          { id: 'station_1', name: 'Triage', position: 0, ...bare },
          {
            id: 'station_2',
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
