import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { LineMapper } from '@work/application/mappers/line.mapper';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import {
  LineSearchPolicy,
  SearchAgent,
  StationSearchOverride,
} from '@work/domain/value-objects/search-policy.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
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
  it('carries the line and every station it has', () => {
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
          judge: null,
          alerts: [],
          search: null,
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
          judge: null,
          alerts: [],
          search: null,
          kind: 'completed',
          skills: [],
        },
      ],
      reactions: [],
      repositories: [],
      source: null,
      replayCheck: null,
      search: {
        enabled: true,
        monthlyCeiling: 50,
        currency: 'USD',
        ceiling: 10,
        period: '7d',
        onAlert: true,
        cooldown: '3d',
      },
    });
  });

  it('resolves the search policy of a work station over its line', () => {
    const searched = Line.rehydrate({
      id: LineId.of('line_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('delivery'),
      name: LineName.of('Delivery'),
      search: LineSearchPolicy.of({
        enabled: false,
        monthlyCeiling: 200,
        currency: 'eur',
        ceiling: 20,
        period: '14d',
        onAlert: false,
        cooldown: '2d',
      }),
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
          position: 2,
          color: StationColor.of('#a3a8b0'),
          kind: 'completed',
        }),
        Station.of({
          id: StationId.of('station_3'),
          key: StationKey.of('build'),
          name: StationName.of('Build'),
          position: 1,
          color: StationColor.of('#a3a8b0'),
          search: StationSearchOverride.of({
            enabled: true,
            ceiling: 40,
            agent: SearchAgent.of({ harness: HarnessId.of('claude-code') }),
            iterations: 4,
            objective: 'cost',
          }),
        }),
      ],
    });

    const [backlog, build] = LineMapper.lineToDto(searched).stations;

    expect(backlog?.search).toBeNull();
    expect(build?.search).toEqual({
      enabled: true,
      monthlyCeiling: 200,
      currency: 'EUR',
      ceiling: 40,
      period: '14d',
      onAlert: false,
      cooldown: '2d',
      agent: { harness: 'claude-code', model: null, effort: null },
      iterations: 4,
      repeats: null,
      objective: 'cost',
    });
  });
});
