import { Station } from '@domain/entities/station.entity';
import { HandoverFor } from '@domain/services/handover-for';
import { Declaration } from '@domain/value-objects/declaration.vo';
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
  }),
  Station.create({
    id: StationId.of('station_2'),
    name: StationName.of('Spec'),
    position: 1,
    color: StationColor.of('#5c66d9'),
  }),
];

const declared = (next?: string, note?: string) =>
  HandoverFor.declared(Declaration.of({ next, note }), stations);

describe('HandoverFor.declared', () => {
  it('passes the task to the station the run named', () => {
    const handover = declared('Spec', 'Reproduced on restart.');

    expect(handover.kind).toBe('pass');
    expect(handover.stationId).toEqual(StationId.of('station_2'));
    expect(handover.body.value).toBe('Reproduced on restart.');
  });

  it('does not mind how the run cased the name', () => {
    expect(declared('spec', 'Done.').stationId).toEqual(
      StationId.of('station_2'),
    );
  });

  it('asks a person when the run says so', () => {
    const handover = declared('review', 'Needs a decision on the retry cap.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toBe('Needs a decision on the retry cap.');
  });

  it('asks a person when the run names nowhere at all', () => {
    expect(declared(undefined, 'Not sure.').kind).toBe('review');
  });

  it('asks a person when the run names a station off this line', () => {
    const handover = declared('Deployment', 'Ship it.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain('not a station on this line');
  });

  it('stands in a body of its own where the run left the note empty', () => {
    expect(declared('Spec').body.value).toBe('Passed on to Spec.');
    expect(declared('review').body.value).toContain('someone to look');
  });
});

describe('HandoverFor.declared, at the station it stands at', () => {
  // The file channel never sees the offered list, so the rule is kept here
  // too: a run that hands the task back where it stands has decided nothing.
  it('asks a person instead of starting the same work again', () => {
    const handover = HandoverFor.declared(
      Declaration.of({ next: 'Triage', note: 'more of the same' }),
      stations,
      StationId.of('station_1'),
    );

    expect(handover.stationId).toBeNull();
    expect(handover.body.value).toContain('already stands');
  });

  it('still passes a task on to a different station', () => {
    const handover = HandoverFor.declared(
      Declaration.of({ next: 'Spec', note: 'needs a spec' }),
      stations,
      StationId.of('station_1'),
    );

    expect(handover.stationId?.value).toBe('station_2');
  });
});
