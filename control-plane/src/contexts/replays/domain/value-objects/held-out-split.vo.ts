import { NoFreshHeldOutError } from '@replays/domain/exceptions/no-fresh-held-out.error';
import { SearchSetTooSmallError } from '@replays/domain/exceptions/search-set-too-small.error';
import type { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const HELD_OUT_RATE = 0.3;

const MIN_HELD_OUT = 2;

const MIN_SEARCHED = 3;

interface SplitEntry {
  readonly runId: RunId;
  readonly taskId: TaskId;
}

const textOrder = (one: string, other: string): number =>
  one < other ? -1 : one > other ? 1 : 0;

const tasksOf = (entries: readonly SplitEntry[]): readonly string[] => [
  ...new Set(entries.map((each) => each.taskId.value)),
];

const heldOutOf = (tasks: number): number => Math.ceil(HELD_OUT_RATE * tasks);

const splits = (tasks: number): boolean =>
  heldOutOf(tasks) >= MIN_HELD_OUT && tasks - heldOutOf(tasks) >= MIN_SEARCHED;

const fewestTasks = (): number => {
  let tasks = 1;

  while (!splits(tasks)) {
    tasks += 1;
  }

  return tasks;
};

export const FEWEST_SEARCH_TASKS = fewestTasks();

export type SplitRefusal = 'too-small' | 'no-fresh';

interface SplitInput {
  readonly searchId: SearchId;
  readonly entries: readonly ReplaySetEntry[];
  readonly hash: (text: string) => string;
  readonly excluding?: readonly TaskId[];
}

export class HeldOutSplit {
  private constructor(
    readonly searched: readonly SplitEntry[],
    readonly heldOut: readonly SplitEntry[],
  ) {}

  static drawn(input: SplitInput): HeldOutSplit {
    const split = HeldOutSplit.tryDraw(input);

    if (split === 'too-small') {
      const tasks = tasksOf(input.entries).length;

      throw new SearchSetTooSmallError(tasks, heldOutOf(tasks));
    }
    if (split === 'no-fresh') {
      throw new NoFreshHeldOutError(
        HeldOutSplit.freshOf(input).length,
        heldOutOf(tasksOf(input.entries).length),
      );
    }

    return split;
  }

  static tryDraw(input: SplitInput): HeldOutSplit | SplitRefusal {
    const tasks = tasksOf(input.entries);

    if (!splits(tasks.length)) {
      return 'too-small';
    }

    const heldOutCount = heldOutOf(tasks.length);
    const fresh = HeldOutSplit.freshOf(input);

    if (fresh.length < heldOutCount) {
      return 'no-fresh';
    }

    const heldOutTasks = new Set(
      fresh
        .map((task) => ({
          task,
          rank: input.hash(`${input.searchId.value}:${task}`),
        }))
        .sort(
          (one, other) =>
            textOrder(one.rank, other.rank) || textOrder(one.task, other.task),
        )
        .slice(0, heldOutCount)
        .map((each) => each.task),
    );
    const entries = input.entries.map((each) => ({
      runId: each.runId,
      taskId: each.taskId,
    }));

    return new HeldOutSplit(
      entries.filter((each) => !heldOutTasks.has(each.taskId.value)),
      entries.filter((each) => heldOutTasks.has(each.taskId.value)),
    );
  }

  private static freshOf(input: SplitInput): readonly string[] {
    const excluded = new Set((input.excluding ?? []).map((each) => each.value));

    return tasksOf(input.entries).filter((each) => !excluded.has(each));
  }

  static rehydrate(input: {
    searched: readonly SplitEntry[];
    heldOut: readonly SplitEntry[];
  }): HeldOutSplit {
    const searchedTasks = new Set(tasksOf(input.searched));

    if (tasksOf(input.heldOut).some((each) => searchedTasks.has(each))) {
      throw new InconsistentStateError(
        'held-out split',
        'both searches and holds out a task',
      );
    }

    return new HeldOutSplit([...input.searched], [...input.heldOut]);
  }

  get searchedRuns(): readonly RunId[] {
    return this.searched.map((each) => each.runId);
  }

  get heldOutRuns(): readonly RunId[] {
    return this.heldOut.map((each) => each.runId);
  }

  get runs(): number {
    return this.searched.length + this.heldOut.length;
  }

  get searchedTasks(): number {
    return tasksOf(this.searched).length;
  }

  get heldOutTasks(): number {
    return tasksOf(this.heldOut).length;
  }

  covers(runs: readonly RunId[]): boolean {
    const all = [...this.searched, ...this.heldOut];

    return (
      runs.length === all.length &&
      runs.every((run) => all.some((each) => each.runId.equals(run)))
    );
  }

  equals(other: HeldOutSplit): boolean {
    const same = (one: readonly SplitEntry[], two: readonly SplitEntry[]) =>
      one.length === two.length &&
      one.every(
        (each, at) =>
          each.runId.equals(two[at].runId) &&
          each.taskId.equals(two[at].taskId),
      );

    return (
      same(this.searched, other.searched) && same(this.heldOut, other.heldOut)
    );
  }
}
