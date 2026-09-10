import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const line = AssemblyLine.of({
  id: AssemblyLineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  factoryId: FactoryId.of('factory_1'),
  name: AssemblyLineName.of('Default'),
  stations: [
    Station.of({
      id: StationId.of('station_1'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_2'),
      name: StationName.of('Completed'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

describe('AssemblyLineMapper.lineToDto', () => {
  it('carries the line and every station it holds', () => {
    expect(AssemblyLineMapper.lineToDto(line)).toEqual({
      id: 'line_1',
      name: 'Default',
      stations: [
        {
          id: 'station_1',
          name: 'Backlog',
          position: 0,
          color: '#a3a8b0',
          description: null,
          harness: null,
          model: null,
          effort: null,
          agentPrompt: null,
          kind: 'backlog',
        },
        {
          id: 'station_2',
          name: 'Completed',
          position: 1,
          color: '#a3a8b0',
          description: null,
          harness: null,
          model: null,
          effort: null,
          agentPrompt: null,
          kind: 'completed',
        },
      ],
      reactions: [],
      repositories: [],
    });
  });
});
