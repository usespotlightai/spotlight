import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const INSIGHTS = Symbol('REPLAYS_INSIGHTS');

export interface InsightsPort {
  acceptedAfter(run: RunId): Promise<boolean>;

  originalOutcomes(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>>;
}
