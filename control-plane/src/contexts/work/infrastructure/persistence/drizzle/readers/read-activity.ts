import {
  activityOf,
  type RunActivity,
  type RunState,
} from '@work/domain/value-objects/run-state';

interface ReadRun {
  readonly state: RunState;
  readonly stopRequestedAt: Date | null;
}

export const readActivityOf = (
  run: ReadRun,
  facts: { readonly awaitsPerson: boolean; readonly current: boolean },
): RunActivity | null =>
  activityOf({
    state: run.state,
    stopRequested: run.stopRequestedAt !== null,
    ...facts,
  });

export const listedActivityOf = (
  run: ReadRun & {
    readonly id: string;
    readonly currentRunId: string | null;
  },
  awaitsPerson: boolean,
): RunActivity | null =>
  readActivityOf(run, { awaitsPerson, current: run.id === run.currentRunId });

export const untaskedActivityOf = (run: ReadRun): RunActivity | null =>
  readActivityOf(run, { awaitsPerson: false, current: false });
