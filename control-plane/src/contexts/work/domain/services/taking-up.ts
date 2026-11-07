export const takesUpRun = (task: {
  readonly holdsRun: boolean;
  readonly awaitsAPerson: boolean;
}): boolean => task.holdsRun && !task.awaitsAPerson;
