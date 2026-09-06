import { Station } from '@domain/entities/station.entity';
import { handoverOptions } from '@domain/services/handover-options';
import { DONE, REVIEW } from '@domain/value-objects/declaration.vo';
import type { HandoverOption } from '@domain/value-objects/handover-option.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const at = (
  id: string,
  name: string,
  position: number,
  passesTo: string[] = [],
  harness: HarnessId | null = HarnessId.of('dev'),
  finishes = false,
) =>
  Station.of({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness,
    wayOut: WayOut.of({ stations: passesTo.map(StationId.of), ends: finishes }),
  });

const triage = at('station_1', 'Triage', 0, ['station_2', 'station_3']);
const spec = at('station_2', 'Spec', 1);
const review = at('station_3', 'Code Review', 2, [], HarnessId.of('dev'), true);
const stations = [triage, spec, review];

const named = (options: HandoverOption[]) => options.map((each) => each.value);

describe('handoverOptions', () => {
  it('offers the stations this one hands on to, in line order', () => {
    expect(
      handoverOptions(triage, stations)
        .slice(0, 2)
        .map((each) => each.value),
    ).toEqual(['Spec', 'Code Review']);
  });

  it('offers only a person to a station that hands on nowhere', () => {
    expect(named(handoverOptions(spec, stations))).toEqual([REVIEW]);
  });

  it('leaves out a station nothing runs at', () => {
    const held = at('station_2', 'Spec', 1, [], null);

    expect(named(handoverOptions(triage, [triage, held, review]))).toEqual([
      'Code Review',
      REVIEW,
    ]);
  });

  it('always offers a person, so an agent is never cornered', () => {
    expect(named(handoverOptions(triage, stations))).toContain(REVIEW);
  });

  it('offers an end only where the station is laid out to finish', () => {
    expect(named(handoverOptions(review, stations))).toContain(DONE);
    expect(named(handoverOptions(triage, stations))).not.toContain(DONE);
  });

  it('offers a person from a station the line does not hold', () => {
    expect(named(handoverOptions(null, stations))).toEqual([REVIEW]);
  });
});
