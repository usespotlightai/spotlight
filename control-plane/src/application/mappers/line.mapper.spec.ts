import { LineMapper } from '@application/mappers/line.mapper';
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
import { describe, expect, it } from 'vitest';

const line = Line.of({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  factoryId: FactoryId.of('factory_1'),
  key: LineKey.of('default'),
  name: LineName.of('Default'),
  stations: [
    Station.of({
      id: StationId.of('station_1'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

describe('LineMapper.lineToDto', () => {
  it('carries the line and every station it holds', () => {
    expect(LineMapper.lineToDto(line)).toEqual({
      id: 'line_1',
      key: 'default',
      name: 'Default',
      stations: [
        {
          id: 'station_1',
          key: 'backlog',
          name: 'Backlog',
          position: 0,
          color: '#a3a8b0',
          description: null,
          harness: null,
          model: null,
          effort: null,
          agentPrompt: null,
          kind: 'backlog',
          skills: [],
        },
        {
          id: 'station_2',
          key: 'completed',
          name: 'Completed',
          position: 1,
          color: '#a3a8b0',
          description: null,
          harness: null,
          model: null,
          effort: null,
          agentPrompt: null,
          kind: 'completed',
          skills: [],
        },
      ],
      reactions: [],
      repositories: [],
    });
  });
});
