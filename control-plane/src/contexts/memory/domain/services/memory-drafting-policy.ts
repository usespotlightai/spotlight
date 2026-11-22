export interface DraftedRun {
  readonly memories: boolean;
}

export const draftsMemoriesAfter = (
  run: DraftedRun,
  handsOver: boolean,
): boolean => run.memories && handsOver;
