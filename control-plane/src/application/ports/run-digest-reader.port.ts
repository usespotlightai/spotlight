import type { RunOutcome } from '@domain/services/run-outcome';
import type { RunId } from '@domain/value-objects/run-id.vo';

export const RUN_DIGESTS = Symbol('RUN_DIGESTS');

/** What runs came to, as it was worked out when each of them ended. */
export interface RunDigestReaderPort {
  /** Keyed by run id. A run that has not been digested is simply absent. */
  forRuns(runIds: readonly RunId[]): Promise<Map<string, RunOutcome>>;
}
