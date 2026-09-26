export const TASK_NOTES_FROM_HOOKS = Symbol('TASK_NOTES_FROM_HOOKS');

export interface TaskNotesFromHooksPort {
  noted(taskId: string, body: string, hook: string): Promise<boolean>;
}
