import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ProposeConfigurationChange } from '@application/services/propose-configuration-change.service';
import { Line } from '@domain/aggregates/line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
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
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        description: StationDescription.of('Where new work lands'),
        harness: HarnessId.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const customising = () => {
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

  const handler = new CustomiseStationHandler(proposals);

  const run = (changes: CustomiseStationCommand['changes']) =>
    handler.execute(
      new CustomiseStationCommand(
        'team_1',
        'user_1',
        'line_1',
        'station_1',
        changes,
      ),
    );

  return {
    run,
    proposals,
    station: () => edited?.stationAt(StationId.of('station_1')),
  };
};

describe('CustomiseStationHandler', () => {
  it('proposes the change, and hands back the pull request', async () => {
    const edit = customising();

    await expect(edit.run({ name: 'Intake' })).resolves.toEqual({
      url: 'https://github.com/acme/api/pull/9',
    });
    expect(edit.proposals.proposeLine).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team_1',
        viewerId: 'user_1',
        lineId: 'line_1',
      }),
    );
    expect(edit.station()?.name.value).toBe('Intake');
  });

  it('leaves alone every field the caller left out', async () => {
    const edit = customising();

    await edit.run({ harness: 'gpu' });

    expect(edit.station()?.description?.value).toBe('Where new work lands');
    expect(edit.station()?.harness?.value).toBe('gpu');
  });

  it('clears a field sent as null', async () => {
    const edit = customising();

    await edit.run({ harness: null });

    expect(edit.station()?.harness).toBeNull();
  });

  it('refuses a colour that is not a hex', async () => {
    await expect(customising().run({ color: 'blue' })).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('refuses a name emptied to blank', async () => {
    await expect(customising().run({ name: '  ' })).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('gives the station the team’s own skills, and refuses Spotlight’s or one named twice', async () => {
    const edit = customising();

    await edit.run({ skills: ['our-migrations'] });

    expect(edit.station()?.skills.map((each) => each.value)).toEqual([
      'our-migrations',
    ]);
    await expect(
      customising().run({ skills: ['our-migrations', 'our-migrations'] }),
    ).rejects.toThrow(UseCaseFault);
    await expect(
      customising().run({ skills: ['spotlight-handover'] }),
    ).rejects.toThrow(UseCaseFault);
  });
});
