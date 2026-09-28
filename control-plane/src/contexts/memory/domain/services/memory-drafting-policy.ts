export interface EndedRun {
  readonly completed: boolean;
  readonly memories: boolean;
}

export const draftsMemoriesAfter = (run: EndedRun): boolean =>
  run.completed && run.memories;
