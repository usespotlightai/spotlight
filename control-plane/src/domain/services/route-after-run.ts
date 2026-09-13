import type { Line } from '@domain/aggregates/line.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { Handover } from '@domain/value-objects/handover.vo';

export type RunRouting =
  | { readonly kind: 'finish' }
  | { readonly kind: 'ask' }
  | {
      readonly kind: 'advance';
      readonly to: Station;
      readonly line: Line;
    };

export const routeAfterRun = (
  handover: Handover,
  line: Line | null,
): RunRouting => {
  if (handover.kind === 'done') {
    return { kind: 'finish' };
  }

  if (handover.kind === 'review' || !handover.stationId || !line) {
    return { kind: 'ask' };
  }

  const to = line.stationAt(handover.stationId);

  return to ? { kind: 'advance', to, line } : { kind: 'ask' };
};
