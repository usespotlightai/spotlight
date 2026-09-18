import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { NowhereToProposeError } from '@work/domain/exceptions/nowhere-to-propose.error';
import { proposalPlacementWithin } from '@work/domain/services/proposal-placement-within';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
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

describe('proposalPlacementWithin', () => {
  it('places a proposal at a station of one of the lines, by their keys', () => {
    const placed = proposalPlacementWithin([LINE], {
      line: ' delivery ',
      station: 'backlog',
    });

    expect(placed.lineId.value).toBe('line_1');
    expect(placed.stationId.value).toBe('station_1');
  });

  it('names the lines there are when it is given none of them', () => {
    expect(() =>
      proposalPlacementWithin([LINE], { line: 'nowhere', station: 'backlog' }),
    ).toThrow(NowhereToProposeError);
    expect(() =>
      proposalPlacementWithin([LINE], { line: 'nowhere', station: 'backlog' }),
    ).toThrow(/the lines are: delivery/);
  });

  it('names the stations a line has when it is given none of them', () => {
    expect(() =>
      proposalPlacementWithin([LINE], { line: 'delivery', station: 'review' }),
    ).toThrow(/its stations are: backlog, completed/);
  });
});
