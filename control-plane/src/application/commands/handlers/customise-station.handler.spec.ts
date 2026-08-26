import { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { CustomiseStationHandler } from '@application/commands/handlers/customise-station.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { RunnerPool } from '@domain/value-objects/runner-pool.vo';
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
        id: StationId.of('station_1'),
        name: StationName.of('Triage'),
        position: 0,
        description: StationDescription.of('Where new work lands'),
        pool: RunnerPool.of('dev'),
        agentPrompt: AgentPrompt.of('## Role'),
      }),
    ],
  });

let saved: AssemblyLine | undefined;

const repository = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    find: vi.fn(async () => found),
    save: vi.fn(async (updated: AssemblyLine) => {
      saved = updated;
    }),
  }) satisfies AssemblyLineRepository;

const customise = (
  changes: CustomiseStationCommand['changes'],
  lines: AssemblyLineRepository = repository(),
) =>
  new CustomiseStationHandler(lines, transaction).execute(
    new CustomiseStationCommand('line_1', 'station_1', changes),
  );

describe('CustomiseStationHandler', () => {
  it('hands back the station as it now stands', async () => {
    await expect(customise({ name: 'Intake' })).resolves.toEqual({
      id: 'station_1',
      name: 'Intake',
      position: 0,
      description: 'Where new work lands',
      pool: 'dev',
      agentPrompt: '## Role',
    });
  });

  it('leaves alone every field the caller left out', async () => {
    await customise({ pool: 'gpu' });

    expect(saved?.stations[0]?.description?.value).toBe('Where new work lands');
    expect(saved?.stations[0]?.pool?.value).toBe('gpu');
  });

  it('clears a field sent as null', async () => {
    const station = await customise({ pool: null });

    expect(station.pool).toBeNull();
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
    await expect(customise({ pool: 'dev' }, repository(null))).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('answers with the station untouched when the change asks nothing', async () => {
    const station = await customise({});

    expect(station).toEqual({
      id: 'station_1',
      name: 'Triage',
      position: 0,
      description: 'Where new work lands',
      pool: 'dev',
      agentPrompt: '## Role',
    });
  });
});
