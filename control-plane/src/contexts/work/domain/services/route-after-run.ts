import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { Handover } from '@work/domain/value-objects/handover.vo';

export type RunRouting =
  | { readonly kind: 'finish'; readonly line: Line }
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
  if (handover.kind === 'done' && line) {
    return { kind: 'finish', line };
  }

  if (handover.kind !== 'pass' || !line) {
    return { kind: 'ask' };
  }

  const to = line.stationAt(handover.stationId);

  return to ? { kind: 'advance', to, line } : { kind: 'ask' };
};
