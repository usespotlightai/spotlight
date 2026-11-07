export const TASK_LINKS = Symbol('TASK_LINKS');

export interface TaskLinksPort {
  taskPage(slug: string, teamId: string, taskId: string): string;
}
