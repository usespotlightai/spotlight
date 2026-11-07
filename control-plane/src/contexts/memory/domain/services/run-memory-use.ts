import { NotAllowedWithoutMemoriesError } from '@memory/domain/exceptions/not-allowed-without-memories.error';

export interface RunIsolation {
  readonly isolated: boolean;
  readonly trial: boolean;
}

export const usesMemories = (run: RunIsolation): boolean =>
  !run.isolated || run.trial;

export const notAllowedWithoutMemories = (
  run: RunIsolation,
  what: string,
): void => {
  if (!usesMemories(run)) {
    throw new NotAllowedWithoutMemoriesError(what);
  }
};
