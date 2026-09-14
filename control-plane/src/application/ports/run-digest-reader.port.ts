import type { RunOutcome } from '@domain/services/run-outcome';
import type { RunId } from '@domain/value-objects/run-id.vo';

export const RUN_DIGESTS = Symbol('RUN_DIGESTS');

export interface RunDigestReaderPort {
  forRuns(runIds: readonly RunId[]): Promise<Map<string, RunOutcome>>;
}
