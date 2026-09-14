import { SetLineRepositoriesHandler } from '@application/commands/handlers/set-line-repositories.handler';
import { SetLineRepositoriesCommand } from '@application/commands/set-line-repositories.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ProposeConfigurationChange } from '@application/services/propose-configuration-change.service';
import { Line } from '@domain/aggregates/line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const line = () =>
  Line.of({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    repositories: [],
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const setting = () => {
  let edited: Line | undefined;

  const proposals = {
    proposeLine: vi.fn(
      async (change: {
        change: (base: Line) => Line;
        describe: (line: Line) => unknown;
      }) => {
        edited = change.change(line());
        change.describe(edited);
        return { url: 'https://github.com/acme/api/pull/9' };
      },
    ),
  } as unknown as ProposeConfigurationChange;

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
    expect(edit.proposals.proposeLine).toHaveBeenCalledWith(
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
