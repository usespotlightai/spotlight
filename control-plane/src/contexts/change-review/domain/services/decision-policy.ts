export interface DecidedTask {
  readonly reviewing: boolean;
}

export interface DecidedRun {
  readonly decisions: boolean;
  readonly completed: boolean;
}

export const keepsDecisions = (task: DecidedTask): boolean => !task.reviewing;

export const decidesFrom = (run: DecidedRun, task: DecidedTask): boolean =>
  run.decisions && run.completed && keepsDecisions(task);
