import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { type PassedOnTask, PassOn } from '@work/domain/services/pass-on';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
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

const AT_TRIAGE = StationId.of('station_1');

const waiting = (over: Partial<PassedOnTask> = {}): PassedOnTask => ({
  stationId: AT_TRIAGE,
  onHold: false,
  awaiting: { ask: null },
  ...over,
});

const targetsOf = (task: PassedOnTask) =>
  PassOn.targets(task, LINE).map((each) => each.value);

describe('PassOn', () => {
  it('offers the stations its station passes work to while the task waits on a question', () => {
    expect(targetsOf(waiting())).toEqual(['station_3']);
  });

  it('offers nothing while the task does not wait on a person', () => {
    expect(targetsOf(waiting({ awaiting: null }))).toEqual([]);
  });

  it('offers nothing while a person holds the task', () => {
    expect(targetsOf(waiting({ onHold: true }))).toEqual([]);
  });

  it('offers nothing while the task waits on an approval or a connection', () => {
    expect(
      targetsOf(
        waiting({
          awaiting: {
            ask: {
              approval: { open: true, askedOf: null },
              connectionAsk: null,
            },
          },
        }),
      ),
    ).toEqual([]);
    expect(
      targetsOf(
        waiting({
          awaiting: {
            ask: {
              approval: null,
              connectionAsk: { met: false, personId: UserId.of('user_1') },
            },
          },
        }),
      ),
    ).toEqual([]);
  });

  it('offers nothing off a line', () => {
    expect(PassOn.targets(waiting(), null)).toEqual([]);
  });

  it('allows only what it offers', () => {
    const task = waiting();

    expect(
      LINE.stations
        .filter((to) => PassOn.allows(task, LINE, to))
        .map((to) => to.id.value),
    ).toEqual(targetsOf(task));
  });
});
