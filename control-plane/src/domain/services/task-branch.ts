/** One branch for the task, so what each station adds lands on one change. */
export const TaskBranch = {
  for(taskId: string): string {
    return `spotlight/${taskId}`;
  },
};
