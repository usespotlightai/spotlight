import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_ARCHIVES = Symbol('RUN_ARCHIVES');

export interface RunArchivesPort {
  /**
   * The archive a later run restores the run's work from: the newest the run stored of its working copy, else the
   * one it started from, while that archive is still available in the run's workspace. Null when there is none.
   */
  restorableFor(run: RunId): Promise<string | null>;
}
