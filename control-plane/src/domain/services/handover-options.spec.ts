import { Station } from '@domain/entities/station.entity';
import { handoverOptions } from '@domain/services/handover-options';
import { REVIEW } from '@domain/value-objects/declaration.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const stations = [
  Station.create({
    id: StationId.of('station_1'),
    name: StationName.of('Triage'),
    position: 0,
    color: StationColor.of('#a3a8b0'),
    harness: HarnessId.of('dev'),
  }),
  Station.create({
    id: StationId.of('station_2'),
    name: StationName.of('Code Review'),
    position: 1,
    color: StationColor.of('#56b98d'),
    harness: HarnessId.of('dev'),
  }),
];

describe('handoverOptions', () => {
  it('offers every station on the line, in order', () => {
    expect(handoverOptions(stations).slice(0, 2)).toEqual([
      'Triage',
      'Code Review',
    ]);
  });

  it('always offers a person, so an agent is never cornered', () => {
    expect(handoverOptions(stations)).toContain(REVIEW);
  });

  it('leaves out a station nothing runs at', () => {
    const backlog = Station.create({
      id: StationId.of('station_0'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
    });

    expect(handoverOptions([backlog, ...stations])).toEqual([
      'Triage',
      'Code Review',
      REVIEW,
    ]);
  });

  it('offers a person even on a line with no stations', () => {
    expect(handoverOptions([])).toEqual([REVIEW]);
  });
});
