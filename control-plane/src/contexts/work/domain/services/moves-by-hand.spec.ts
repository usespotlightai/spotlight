import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { MovesByHand } from '@work/domain/services/moves-by-hand';
import type { PassedOnTask } from '@work/domain/services/pass-on';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { Station } from '@work/domain/value-objects/station.vo';
import { describe, expect, it } from 'vitest';

const station = (
  id: string,
  name: string,
  position: number,
  over: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(id.replace('_', '-')),
    name: StationName.of(name),
    position,
    color: '#a3a8b0',
    ...over,
  });

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_0', 'Backlog', 0, { kind: 'backlog' }),
    station('station_1', 'Triage', 1, {
      harness: HarnessId.of('dev'),
      routes: routesOf({
        stations: [StationId.of('station_3'), StationId.of('station_4')],
      }),
    }),
    station('station_2', 'Design', 2, { harness: HarnessId.of('dev') }),
    station('station_3', 'Spec', 3, { harness: HarnessId.of('dev') }),
    station('station_4', 'Manual', 4),
    station('completed_1', 'Completed', 5, { kind: 'completed' }),
  ],
});

const task = (
  stationId: string,
  awaiting: PassedOnTask['awaiting'] = null,
): PassedOnTask => ({
  stationId: StationId.of(stationId),
  onHold: false,
  awaiting,
});

const QUESTION = { ask: { approval: null, connectionAsk: null } };

const movableTo = (moved: PassedOnTask) =>
  MovesByHand.targets(moved, LINE).map((each) => each.value);

const stationNamed = (id: string): Station => {
  const found = LINE.stationAt(StationId.of(id));

  if (!found) {
    throw new Error(`The line has no station ${id}.`);
  }

  return found;
};

describe('MovesByHand', () => {
  it('lets a person start, park or finish a task, and leave it where it is', () => {
    expect(movableTo(task('station_0'))).toEqual([
      'station_0',
      'station_1',
      'station_2',
      'station_3',
      'station_4',
      'completed_1',
    ]);
    expect(movableTo(task('station_1'))).toEqual([
      'station_0',
      'station_1',
      'completed_1',
    ]);
  });

  it('lets a person pass on a task that waits on a question, where its agent could', () => {
    expect(movableTo(task('station_1', QUESTION))).toEqual([
      'station_0',
      'station_1',
      'station_3',
      'completed_1',
    ]);
  });

  it('keeps a completed task completed', () => {
    expect(movableTo(task('completed_1'))).toEqual(['completed_1']);
    expect(
      MovesByHand.denial(task('completed_1'), LINE, stationNamed('station_0')),
    ).toBe('out-of-completed');
  });

  it('denies a move between work stations that no pass-on allows', () => {
    expect(
      MovesByHand.denial(
        task('station_1', QUESTION),
        LINE,
        stationNamed('station_2'),
      ),
    ).toBe('between-work-stations');
    expect(
      MovesByHand.denial(
        task('station_1', QUESTION),
        LINE,
        stationNamed('station_3'),
      ),
    ).toBeNull();
  });

  it('offers nothing off a line', () => {
    expect(MovesByHand.targets(task('station_1'), null)).toEqual([]);
  });

  it('will not judge a move from a station that is not on the line', () => {
    expect(() =>
      MovesByHand.denial(task('station_9'), LINE, stationNamed('station_0')),
    ).toThrow(UnknownStationError);
    expect(MovesByHand.targets(task('station_9'), LINE)).toEqual([]);
  });
});
