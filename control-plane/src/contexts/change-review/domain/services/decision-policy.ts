export interface DecidedTask {
  readonly reviewing: boolean;
}

export interface DecidedRun {
  readonly decisions: boolean;
}

export const keepsDecisions = (task: DecidedTask): boolean => !task.reviewing;

export const decidesFrom = (
  run: DecidedRun,
  handsOver: boolean,
  task: DecidedTask,
): boolean => run.decisions && handsOver && keepsDecisions(task);
