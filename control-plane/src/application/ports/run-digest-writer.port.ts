import type { RunId } from '@domain/value-objects/run-id.vo';

export const RUN_DIGEST_WRITER = Symbol('RUN_DIGEST_WRITER');

export interface RunDigestWriterPort {
  /**
   * Works out what these runs came to, for the finished ones that have no
   * digest yet. Doing nothing is the usual answer, and doing it twice is
   * harmless: a run's journal cannot change once the run is over.
   */
  ensure(runIds: readonly RunId[]): Promise<void>;

  /**
   * The same, for every finished run that has no digest at all — runs that
   * ended before anything was keeping this record.
   */
  catchUp(): Promise<void>;
}
