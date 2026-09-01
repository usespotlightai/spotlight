import { Station } from '@domain/entities/station.entity';
import { HandoverFor } from '@domain/services/handover-for';
import { Declaration } from '@domain/value-objects/declaration.vo';
import type { Handover } from '@domain/value-objects/handover.vo';
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
    name: StationName.of('Spec'),
    position: 1,
    color: StationColor.of('#5c66d9'),
    harness: HarnessId.of('dev'),
  }),
];

const declared = (next?: string, note?: string) =>
  HandoverFor.declared(Declaration.of({ next, note }), stations);

const passedTo = (handover: Handover): StationId | null =>
  handover.kind === 'pass' ? handover.stationId : null;

describe('HandoverFor.declared', () => {
  it('will not pass a task to a station nothing runs at', () => {
    const backlog = Station.create({
      id: StationId.of('station_0'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
    });
    const handover = HandoverFor.declared(
      Declaration.of({ next: 'Backlog', note: 'Not ready yet.' }),
      [backlog, ...stations],
    );

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain('nothing runs to take the task up');
  });

  it('passes the task to the station the run named', () => {
    const handover = declared('Spec', 'Reproduced on restart.');

    expect(handover.kind).toBe('pass');
    expect(passedTo(handover)).toEqual(StationId.of('station_2'));
    expect(handover.body.value).toBe('Reproduced on restart.');
  });

  it('does not mind how the run cased the name', () => {
    expect(passedTo(declared('spec', 'Done.'))).toEqual(
      StationId.of('station_2'),
    );
  });

  it('asks a person when the run says so', () => {
    const handover = declared('review', 'Needs a decision on the retry cap.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toBe('Needs a decision on the retry cap.');
  });

  it('ends the line when the run says the work is done', () => {
    const handover = declared('done', 'Pull request opened.');

    expect(handover.kind).toBe('done');
    expect(passedTo(handover)).toBeNull();
    expect(handover.body.value).toBe('Pull request opened.');
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
    expect(declared('done').body.value).toBe('The work is done.');
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

    expect(passedTo(handover)).toBeNull();
    expect(handover.body.value).toContain('already stands');
  });

  it('still passes a task on to a different station', () => {
    const handover = HandoverFor.declared(
      Declaration.of({ next: 'Spec', note: 'needs a spec' }),
      stations,
      StationId.of('station_1'),
    );

    expect(passedTo(handover)?.value).toBe('station_2');
  });
});
