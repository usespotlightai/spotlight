import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ProposeLineChange } from '@application/services/propose-line-change.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
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
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        description: StationDescription.of('Where new work lands'),
        harness: HarnessId.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

// The handler's whole job is to turn a command into a change on the line and
// hand it to ProposeLineChange; the stub runs that change so the edit can be
// inspected, standing in for the git-first write the real service performs.
const customising = () => {
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
    expect(edit.proposals.propose).toHaveBeenCalledWith(
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
});
