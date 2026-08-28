import { ReorderStationsHandler } from '@application/commands/handlers/reorder-stations.handler';
import { ReorderStationsCommand } from '@application/commands/reorder-stations.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TransactionPort } from '@application/ports/transaction.port';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction: TransactionPort = { run: (work) => work() };

const at = (id: string, name: string, position: number) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      at('station_1', 'Backlog', 0),
      at('station_2', 'Triage', 1),
      at('station_3', 'Spec', 2),
    ],
  });

let saved: AssemblyLine | undefined;

const lines = (found: AssemblyLine | null = line()) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (updated: AssemblyLine) => {
      saved = updated;
    }),
    find: vi.fn(async () => found),
  }) satisfies AssemblyLineRepository;

const reorder = (order: string[], board: AssemblyLineRepository = lines()) =>
  new ReorderStationsHandler(board, transaction).execute(
    new ReorderStationsCommand('line_1', order),
  );

beforeEach(() => {
  saved = undefined;
});

describe('ReorderStationsHandler', () => {
  it('stands the stations in the order it was given', async () => {
    await reorder(['station_3', 'station_1', 'station_2']);

    expect(saved?.stations.map((each) => each.name.value)).toEqual([
      'Spec',
      'Backlog',
      'Triage',
    ]);
  });

  it('numbers the places again from the start', async () => {
    await reorder(['station_3', 'station_1', 'station_2']);

    expect(saved?.stations.map((each) => each.position)).toEqual([0, 1, 2]);
  });

  it('carries everything else about a station across the move', async () => {
    await reorder(['station_3', 'station_1', 'station_2']);

    expect(saved?.stations[0]?.id).toEqual(StationId.of('station_3'));
    expect(saved?.stations[0]?.color.value).toBe('#a3a8b0');
  });

  it('refuses an order that leaves a station out', async () => {
    await expect(reorder(['station_1', 'station_2'])).rejects.toThrow(
      UseCaseFault,
    );
  });

  it('refuses an order naming a station the line does not hold', async () => {
    await expect(
      reorder(['station_1', 'station_2', 'station_elsewhere']),
    ).rejects.toThrow(UseCaseFault);
  });

  it('refuses a line that does not exist', async () => {
    await expect(
      reorder(['station_1', 'station_2', 'station_3'], lines(null)),
    ).rejects.toThrow(UseCaseFault);
  });
});
