export interface DrivenRun {
  readonly drivenByAPerson: boolean;
}

export interface PutToAPerson extends DrivenRun {
  readonly runAsked: boolean;
}

export const isLineWork = (run: DrivenRun): boolean => !run.drivenByAPerson;

export const asksAPerson = (ask: PutToAPerson): boolean =>
  isLineWork(ask) && ask.runAsked;
