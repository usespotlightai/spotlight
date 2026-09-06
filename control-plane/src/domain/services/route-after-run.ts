import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { Handover } from '@domain/value-objects/handover.vo';

/**
 * What becomes of a task once its run has spoken: it finishes, it goes back to
 * a person, or it advances to a named station. Advancing needs a station that
 * still stands on a line the task is on — a handover pointing nowhere reachable
 * falls back to asking, rather than stranding the task.
 */
export type RunRouting =
  | { readonly kind: 'finish' }
  | { readonly kind: 'ask' }
  | {
      readonly kind: 'advance';
      readonly to: Station;
      readonly line: AssemblyLine;
    };

export const routeAfterRun = (
  handover: Handover,
  line: AssemblyLine | null,
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
