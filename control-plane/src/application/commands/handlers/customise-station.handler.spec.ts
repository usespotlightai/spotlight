import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { StandingWork } from '@application/services/standing-work';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
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

const transaction: TransactionPort = { run: (work) => work() };

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      Station.create({
        id: StationId.of('station_0'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.create({
        id: StationId.of('station_1'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        description: StationDescription.of('Where new work lands'),
        harness: HarnessId.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
      }),
      Station.create({
        id: StationId.of('station_2'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

let saved: AssemblyLine | undefined;

const repository = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    find: vi.fn(async () => found),
    holding: vi.fn(async () => found),
    save: vi.fn(async (updated: AssemblyLine) => {
      saved = updated;
    }),
  }) satisfies AssemblyLineRepository;

const tookUp = vi.fn(async () => {});
const work = { takeUp: tookUp } as StandingWork;

const customise = (
  changes: CustomiseStationCommand['changes'],
  lines: AssemblyLineRepository = repository(),
) =>
  new CustomiseStationHandler(lines, work, transaction).execute(
    new CustomiseStationCommand('line_1', 'station_1', changes),
  );

describe('CustomiseStationHandler', () => {
  it('hands back the station as it now stands', async () => {
    await expect(customise({ name: 'Intake' })).resolves.toEqual({
      id: 'station_1',
      name: 'Intake',
      position: 1,
      kind: 'work',
      color: '#a3a8b0',
      description: 'Where new work lands',
      harness: 'dev',
      agentPrompt: '## Role',
    });
  });

  it('leaves alone every field the caller left out', async () => {
    await customise({ harness: 'gpu' });

    expect(saved?.worked[0]?.description?.value).toBe('Where new work lands');
    expect(saved?.worked[0]?.harness?.value).toBe('gpu');
  });

  it('repaints the station when a colour is given', async () => {
    const station = await customise({ color: '#5C66D9' });

    expect(station.color).toBe('#5c66d9');
  });

  it('refuses a colour that is not a hex', async () => {
    await expect(customise({ color: 'blue' })).rejects.toThrow(UseCaseFault);
  });

  it('clears a field sent as null', async () => {
    const station = await customise({ harness: null });

    expect(station.harness).toBeNull();
  });

  it('refuses a field that is nothing but whitespace', async () => {
    await expect(customise({ description: '   ' })).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('refuses a name emptied to blank, having nothing to fall back to', async () => {
    await expect(customise({ name: '  ' })).rejects.toThrow(UseCaseFault);
  });

  it('refuses a line that does not exist', async () => {
    await expect(
      customise({ harness: 'dev' }, repository(null)),
    ).rejects.toThrow(UseCaseFault);
  });

  it('answers with the station untouched when the change asks nothing', async () => {
    const station = await customise({});

    expect(station).toEqual({
      id: 'station_1',
      name: 'Triage',
      position: 1,
      kind: 'work',
      color: '#a3a8b0',
      description: 'Where new work lands',
      harness: 'dev',
      agentPrompt: '## Role',
    });
  });

  it('asks for the standing work to be taken up once the station is saved', async () => {
    tookUp.mockClear();

    await customise({ harness: 'claude-code' });

    expect(tookUp).toHaveBeenCalledTimes(1);
  });
});
