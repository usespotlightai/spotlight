import { NotAllowedInIsolatedRunError } from '@memory/domain/exceptions/not-allowed-in-isolated-run.error';

export interface RunIsolation {
  readonly isolated: boolean;
  readonly trial: boolean;
}

export const usesMemories = (run: RunIsolation): boolean =>
  !run.isolated || run.trial;

export const notAllowedInIsolatedRun = (
  run: RunIsolation,
  what: string,
): void => {
  if (!usesMemories(run)) {
    throw new NotAllowedInIsolatedRunError(what);
  }
};
