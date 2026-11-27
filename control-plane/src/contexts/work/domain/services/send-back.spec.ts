import { present } from '@shared-kernel/domain/present.fake-spec';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { SendBack } from '@work/domain/services/send-back';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { describe, expect, it } from 'vitest';

let next = 0;
const line = deliveryLineOf({
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  newId: () => `id_${++next}`,
});

const keyed = (on: LineMap, key: string) =>
  present(on.stations.find((each) => each.key.value === key));

describe('SendBack', () => {
  const at = (key: string, finished: boolean) => ({
    stationId: keyed(line, key).id,
    finished,
  });
  const sentBackFrom = (task: { stationId: StationId; finished: boolean }) =>
    line.stations
      .filter((to) => SendBack.allows(task, line, to))
      .map((to) => to.key.value);

  it('sends a finished task back to an earlier work station, or to one its station passes to', () => {
    expect(sentBackFrom(at('code-review', true))).toEqual([
      'triage',
      'spec',
      'implementation',
    ]);
    expect(
      SendBack.allows(
        at('code-review', true),
        line,
        keyed(line, 'implementation'),
      ),
    ).toBe(true);
  });

  it('sends back no task that the line has not finished', () => {
    expect(sentBackFrom(at('code-review', false))).toEqual([]);
    expect(
      SendBack.allows(
        at('code-review', false),
        line,
        keyed(line, 'implementation'),
      ),
    ).toBe(false);
  });

  it('sends back nothing from a station off the line', () => {
    expect(
      sentBackFrom({ stationId: StationId.of('elsewhere'), finished: true }),
    ).toEqual([]);
  });
});
