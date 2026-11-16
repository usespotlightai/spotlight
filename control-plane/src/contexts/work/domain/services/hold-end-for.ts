import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { HoldEnd } from '@work/domain/value-objects/hold-end';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export interface ResumeAsked {
  readonly next: HoldEnd;
  readonly to: StationId | null;
}

export const holdEndFor = (
  handover: Handover,
  line: LineMap,
  at: StationId,
): ResumeAsked | null => {
  if (handover.isDone()) {
    return { next: 'finish', to: null };
  }

  const named = line
    .resumeOptionsAt(at)
    .find((each) => each.station !== null && handover.names(each.station.key));
  const station = named?.station ? line.stationKeyed(named.station.key) : null;

  if (!station) {
    return null;
  }

  return station.id.equals(at)
    ? { next: 'continue', to: null }
    : { next: 'move-on', to: station.id };
};
