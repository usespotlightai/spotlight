import { Line } from '@domain/aggregates/line.aggregate';
import { Station } from '@domain/entities/station.entity';
import { NowhereToProposeError } from '@domain/exceptions/nowhere-to-propose.error';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const LINE = Line.of({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  factoryId: FactoryId.of('factory_1'),
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

describe('ProposalPlacement', () => {
  it('places a proposal at a station of one of the lines, by their keys', () => {
    const placed = ProposalPlacement.within([LINE], ' delivery ', 'backlog');

    expect(placed.lineId.value).toBe('line_1');
    expect(placed.stationId.value).toBe('station_1');
  });

  it('names the lines there are when it is given none of them', () => {
    expect(() =>
      ProposalPlacement.within([LINE], 'nowhere', 'backlog'),
    ).toThrow(NowhereToProposeError);
    expect(() =>
      ProposalPlacement.within([LINE], 'nowhere', 'backlog'),
    ).toThrow(/the lines are: delivery/);
  });

  it('names the stations a line has when it is given none of them', () => {
    expect(() =>
      ProposalPlacement.within([LINE], 'delivery', 'review'),
    ).toThrow(/its stations are: backlog, completed/);
  });
});
