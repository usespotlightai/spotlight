import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { routeAfterRun } from '@work/domain/services/route-after-run';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const station = (
  id: string,
  name: string,
  position: number,
  over: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(id.replace('_', '-')),
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
    station('station_0', 'Backlog', 0, { kind: 'backlog' }),
    station('station_1', 'Triage', 1, {
      harness: HarnessId.of('dev'),
      wayOut: WayOut.of({ stations: [StationId.of('station_2')], ends: true }),
    }),
    station('station_2', 'Spec', 2, { harness: HarnessId.of('dev') }),
    station('station_3', 'Build', 3, { harness: HarnessId.of('dev') }),
    station('completed_1', 'Completed', 4, { kind: 'completed' }),
  ],
});

const NOTE = TaskNoteBody.of('Over to you.');
const FAILURE = TaskFailure.fromRun('exited');
const BUILD = StationId.of('station_3');
const GONE = StationId.of('station_gone');

const working = (deferredMoveTo: StationId | null) => ({
  awaitingReview: false,
  deferredMoveTo,
});

const waiting = (deferredMoveTo: StationId | null) => ({
  awaitingReview: true,
  deferredMoveTo,
});

const endings: readonly [string, ResolvedHandover][] = [
  ['asks a person', ResolvedHandover.review(NOTE)],
  ['hands over the task as done', ResolvedHandover.done(NOTE)],
  ['fails', ResolvedHandover.failed(NOTE, FAILURE)],
];

describe('routeAfterRun', () => {
  it('passes the task on where the run passed it, whatever was deferred', () => {
    expect(
      routeAfterRun(
        ResolvedHandover.pass(StationId.of('station_2'), NOTE),
        LINE,
        working(BUILD),
      ),
    ).toMatchObject({ kind: 'advance', to: { id: StationId.of('station_2') } });
  });

  it.each(endings)(
    'takes the task where a move was deferred to when the run %s',
    (_, handover) => {
      expect(routeAfterRun(handover, LINE, working(BUILD))).toMatchObject({
        kind: 'deferredMove',
        to: { id: BUILD },
      });
    },
  );

  it('takes the task where a move was deferred to when the run passes it somewhere off the line', () => {
    expect(
      routeAfterRun(ResolvedHandover.pass(GONE, NOTE), LINE, working(BUILD)),
    ).toMatchObject({ kind: 'deferredMove', to: { id: BUILD } });
  });

  it('ends as the run handed over where the station deferred to has left the line', () => {
    expect(
      routeAfterRun(ResolvedHandover.review(NOTE), LINE, working(GONE)),
    ).toEqual({
      kind: 'ask',
      failure: null,
    });
    expect(
      routeAfterRun(
        ResolvedHandover.failed(NOTE, FAILURE),
        LINE,
        working(GONE),
      ),
    ).toEqual({
      kind: 'ask',
      failure: FAILURE,
    });
    expect(
      routeAfterRun(ResolvedHandover.done(NOTE), LINE, working(GONE)),
    ).toMatchObject({
      kind: 'finish',
    });
  });

  it('ends as the run handed over with nothing deferred', () => {
    expect(
      routeAfterRun(ResolvedHandover.review(NOTE), LINE, working(null)),
    ).toEqual({
      kind: 'ask',
      failure: null,
    });
    expect(
      routeAfterRun(ResolvedHandover.done(NOTE), LINE, working(null)),
    ).toMatchObject({
      kind: 'finish',
    });
  });

  describe('while the task waits on a person', () => {
    it.each(endings)(
      'takes the task where a move was deferred to when the run %s',
      (_, handover) => {
        expect(routeAfterRun(handover, LINE, waiting(BUILD))).toMatchObject({
          kind: 'deferredMove',
          to: { id: BUILD },
        });
      },
    );

    it('detaches the task, still asked, with nothing deferred', () => {
      expect(
        routeAfterRun(ResolvedHandover.done(NOTE), LINE, waiting(null)),
      ).toEqual({
        kind: 'detach',
        failure: null,
      });
      expect(
        routeAfterRun(
          ResolvedHandover.failed(NOTE, FAILURE),
          LINE,
          waiting(null),
        ),
      ).toEqual({ kind: 'detach', failure: FAILURE });
    });

    it('never passes the task on where the run passed it', () => {
      expect(
        routeAfterRun(
          ResolvedHandover.pass(StationId.of('station_2'), NOTE),
          LINE,
          waiting(null),
        ),
      ).toEqual({ kind: 'detach', failure: null });
      expect(
        routeAfterRun(
          ResolvedHandover.pass(StationId.of('station_2'), NOTE),
          LINE,
          waiting(BUILD),
        ),
      ).toMatchObject({ kind: 'deferredMove', to: { id: BUILD } });
    });
  });

  it('asks a person where the task is on no line', () => {
    expect(
      routeAfterRun(ResolvedHandover.done(NOTE), null, working(BUILD)),
    ).toEqual({
      kind: 'ask',
      failure: null,
    });
  });
});
