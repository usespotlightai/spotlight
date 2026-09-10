import { SetLineRepositoriesHandler } from '@application/commands/handlers/set-line-repositories.handler';
import { SetLineRepositoriesCommand } from '@application/commands/set-line-repositories.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ProposeLineChange } from '@application/services/propose-line-change.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    repositories: [],
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

// The stub runs the change callback so the resulting edit can be inspected.
const setting = () => {
  let edited: AssemblyLine | undefined;

  const proposals = {
    propose: vi.fn(
      async (change: {
        change: (base: AssemblyLine) => AssemblyLine;
        describe: (line: AssemblyLine) => unknown;
      }) => {
        edited = change.change(line());
        change.describe(edited);
        return { url: 'https://github.com/acme/api/pull/9' };
      },
    ),
  } as unknown as ProposeLineChange;

  const handler = new SetLineRepositoriesHandler(proposals);

  const run = (repositories: string[]) =>
    handler.execute(
      new SetLineRepositoriesCommand(
        'team_1',
        'user_1',
        'line_1',
        repositories,
      ),
    );

  return { run, proposals, line: () => edited };
};

describe('SetLineRepositoriesHandler', () => {
  it('sets the line’s repositories, and hands back the pull request', async () => {
    const edit = setting();

    await expect(edit.run(['acme/api', 'acme/web'])).resolves.toEqual({
      url: 'https://github.com/acme/api/pull/9',
    });
    expect(edit.proposals.propose).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team_1',
        viewerId: 'user_1',
        lineId: 'line_1',
      }),
    );
    expect(edit.line()?.repositories.all.map((each) => each.value)).toEqual([
      'acme/api',
      'acme/web',
    ]);
  });

  it('empties the line’s repositories when given none', async () => {
    const edit = setting();

    await edit.run([]);

    expect(edit.line()?.repositories.all).toEqual([]);
  });

  it('refuses a repository that is not owner/name', async () => {
    await expect(setting().run(['not-a-repo'])).rejects.toThrow(UseCaseFault);
  });
});
