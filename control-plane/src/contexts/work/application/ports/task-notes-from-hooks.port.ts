export const TASK_NOTES_FROM_HOOKS = Symbol('TASK_NOTES_FROM_HOOKS');

export interface HookFailureReport {
  readonly taskId: string;
  readonly stationKey: string;
  readonly hook: string;
  readonly code: string;
  readonly reason: string;
  readonly receivedAs: string;
}

export type HookFailureNotice = 'reported' | 'superseded' | 'gone';

export interface TaskNotesFromHooksPort {
  noted(
    taskId: string,
    body: string,
    hook: string,
    receivedAs: string | null,
  ): Promise<boolean>;

  failed(report: HookFailureReport): Promise<HookFailureNotice>;

  movedOn(taskId: string, stationKey: string): Promise<boolean>;
}
