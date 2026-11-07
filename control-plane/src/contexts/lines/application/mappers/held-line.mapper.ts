import type { HeldLine } from '@lines/application/ports/station-holders.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';

export const heldLineOf = (line: Line): HeldLine => ({
  lineId: line.id.value,
  workspaceId: line.workspaceId.value,
  teamId: line.teamId.value,
  lineKey: line.key.value,
  lineName: line.name.value,
  stations: line.stations.map((each) => ({
    id: each.id.value,
    key: each.key.value,
    name: each.name.value,
    kind: each.kind,
    color: each.color.value,
    position: each.position,
  })),
});
