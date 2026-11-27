import { firstOf } from '@shared-kernel/domain/item-at';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

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

  return named ?? newestHolderOf(keys.marks, tasks) ?? firstOf(tasks) ?? null;
};

// A pull request that closes ends every review of it, not only the one that holds its review mark.
export const closesReviewsOf = (
  keys: CorrelationKeys,
  closed: PullRequestUrl,
): boolean => {
  const mark = Mark.review(closed);

  return keys.marks.some((each) => each.equals(mark));
};

// The reviews of a closed pull request other than the one that heard the close. A review that another review took the mark from is one of them.
export const otherReviewsOf = (
  heard: Task | null,
  reviews: readonly Task[],
): readonly Task[] =>
  reviews.filter((each) => !(heard?.id.equals(each.id) ?? false));
