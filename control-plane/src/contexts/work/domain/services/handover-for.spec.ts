import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import {
  Station,
  type StationInput,
} from '@work/domain/entities/station.entity';
import { HandoverFor } from '@work/domain/services/handover-for';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const station = (
  id: string,
  key: string,
  name: string,
  position: number,
  over: Partial<StationInput> = {},
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(key),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    ...over,
  });

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_0', 'backlog', 'Backlog', 0, { kind: 'backlog' }),
    station('station_1', 'triage', 'Triage', 1, {
      harness: HarnessId.of('dev'),
      wayOut: WayOut.of({ stations: [StationId.of('station_2')] }),
    }),
    station('station_2', 'spec', 'Spec', 2, {
      harness: HarnessId.of('dev'),
      wayOut: WayOut.of({ stations: [StationId.of('station_1')], ends: true }),
    }),
    station('station_3', 'code-review', 'Code Review', 3, {
      harness: HarnessId.of('dev'),
    }),
    station('station_4', 'completed', 'Completed', 4, { kind: 'completed' }),
  ],
});

const resolved = (next?: string, note?: string, from = 'station_1') =>
  HandoverFor.resolve(Handover.of({ next, note }), LINE, StationId.of(from));

const passedTo = (handover: ResolvedHandover): StationId | null =>
  handover.kind === 'pass' ? handover.stationId : null;

describe('HandoverFor.resolve', () => {
  it('passes the task to the station the run named by its key', () => {
    const handover = resolved('spec', 'Reproduced on restart.');

    expect(handover.kind).toBe('pass');
    expect(passedTo(handover)).toEqual(StationId.of('station_2'));
    expect(handover.body.value).toBe('Reproduced on restart.');
  });

  it('does not mind how the run cased the key', () => {
    expect(passedTo(resolved('SPEC', 'Done.'))).toEqual(
      StationId.of('station_2'),
    );
  });

  it('does not take a station’s display name for its key', () => {
    const handover = resolved('Code Review');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain('This line has no such station.');
  });

  it('will not pass a task to a station nothing runs at', () => {
    const handover = resolved('backlog', 'Not ready yet.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain(
      'Nothing runs there to take up the task.',
    );
  });

  it('will not pass a task where work does not pass to from where it is', () => {
    const handover = resolved('code-review', 'Looks done.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain('Work does not pass there');
  });

  it('asks a person when the run hands over to review', () => {
    const handover = resolved('review', 'Needs a decision on the retry cap.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toBe('Needs a decision on the retry cap.');
  });

  it('ends the line where the run hands over the task as done and the line ends there', () => {
    const handover = resolved('done', 'Pull request opened.', 'station_2');

    expect(handover.kind).toBe('done');
    expect(passedTo(handover)).toBeNull();
    expect(handover.body.value).toBe('Pull request opened.');
  });

  it('asks a person where the run hands over the task as done and the line goes on', () => {
    const handover = resolved('done', 'Pull request opened.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain('is not at the end of its line');
  });

  it('asks a person when the run names nowhere at all', () => {
    expect(resolved(undefined, 'Not sure.').kind).toBe('review');
  });

  it('asks a person when the run names a station off this line', () => {
    const handover = resolved('deployment', 'Ship it.');

    expect(handover.kind).toBe('review');
    expect(handover.body.value).toContain('This line has no such station.');
  });

  it('asks a person where the task is on no line', () => {
    const handover = HandoverFor.resolve(
      Handover.of({ next: 'spec' }),
      null,
      StationId.of('station_1'),
    );

    expect(handover.kind).toBe('review');
  });

  it('writes a body of its own where the run left the note empty', () => {
    expect(resolved('spec').body.value).toBe('Passed on to Spec.');
    expect(resolved('review').body.value).toContain('someone to look');
    expect(resolved('done', undefined, 'station_2').body.value).toBe(
      'The work is done.',
    );
  });
});

describe('HandoverFor.resolve, at the station it is at', () => {
  it('asks a person instead of starting the same work again', () => {
    const handover = resolved('triage', 'more of the same');

    expect(passedTo(handover)).toBeNull();
    expect(handover.body.value).toContain('is already there');
  });

  it('still passes a task on to a different station', () => {
    expect(passedTo(resolved('spec', 'needs a spec'))?.value).toBe('station_2');
  });
});

describe('HandoverFor.after', () => {
  const handover = Handover.of({ next: 'spec' });
  const currentStation = StationId.of('station_1');

  it('hands a stopped run back to a person, whatever it handed over', () => {
    expect(
      HandoverFor.after({
        outcome: RunOutcome.stopped(0),
        handover,
        line: LINE,
        currentStation,
      }),
    ).toEqual(HandoverFor.stopped());
  });

  it('follows the handover of a run that did not fail', () => {
    expect(
      HandoverFor.after({
        outcome: RunOutcome.of({ exitCode: 0, failed: false }),
        handover,
        line: LINE,
        currentStation,
      }).kind,
    ).toBe('pass');
  });

  it('reads the outcome of a run that failed or handed over nothing', () => {
    const failed = RunOutcome.of({ exitCode: 1, failed: true });
    const silent = RunOutcome.of({ exitCode: 0, failed: false });

    expect(
      HandoverFor.after({
        outcome: failed,
        handover,
        line: LINE,
        currentStation,
      }),
    ).toEqual(HandoverFor.outcome(failed));
    expect(
      HandoverFor.after({
        outcome: silent,
        handover: null,
        line: LINE,
        currentStation,
      }),
    ).toEqual(HandoverFor.outcome(silent));
  });
});
