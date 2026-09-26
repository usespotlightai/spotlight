export const TASK_NOTES_FROM_HOOKS = Symbol('TASK_NOTES_FROM_HOOKS');

export interface HookFailureReport {
  readonly taskId: string;
  readonly stationKey: string;
  readonly hook: string;
  readonly code: string;
  readonly saying: string;
  readonly heardAs: string;
}

export type HookFailureHeard = 'reported' | 'superseded' | 'gone';

export interface TaskNotesFromHooksPort {
  noted(
    taskId: string,
    body: string,
    hook: string,
    heardAs: string | null,
  ): Promise<boolean>;

  failed(report: HookFailureReport): Promise<HookFailureHeard>;

  movedOn(taskId: string, stationKey: string): Promise<boolean>;
}
