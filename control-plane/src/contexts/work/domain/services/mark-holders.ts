import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

const heldSince = (task: Task, marks: readonly Mark[]): number | null =>
  marks.reduce<number | null>((latest, mark) => {
    const held = task.holdsMark(mark)?.since.getTime() ?? null;

    return held !== null && (latest === null || held > latest) ? held : latest;
  }, null);

const newestHolderOf = (
  marks: readonly Mark[],
  tasks: readonly Task[],
): Task | null =>
  tasks.reduce<{ task: Task; since: number } | null>((newest, task) => {
    const since = heldSince(task, marks);

    if (since === null) {
      return newest;
    }

    return newest === null ||
      since > newest.since ||
      (since === newest.since && task.id.value > newest.task.id.value)
      ? { task, since }
      : newest;
  }, null)?.task ?? null;

export const markHolderAmong = (
  mark: Mark,
  tasks: readonly Task[],
): Task | null => newestHolderOf([mark], tasks);

export const correlatedTaskAmong = (
  keys: CorrelationKeys,
  tasks: readonly Task[],
): Task | null => {
  const { branch } = keys;
  const named = branch
    ? tasks.find((each) => each.branch.equals(branch))
    : undefined;

  return named ?? newestHolderOf(keys.marks, tasks) ?? tasks[0] ?? null;
};
