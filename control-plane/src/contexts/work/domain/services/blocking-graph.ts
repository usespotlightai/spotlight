import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

interface BlockingLink {
  readonly task: TaskId;
  readonly blockedBy: readonly TaskId[];
}

export class BlockingGraph {
  private constructor(
    private readonly blockers: ReadonlyMap<string, readonly TaskId[]>,
  ) {}

  static of(links: readonly BlockingLink[]): BlockingGraph {
    return new BlockingGraph(
      new Map(links.map((each) => [each.task.value, each.blockedBy] as const)),
    );
  }

  static empty(): BlockingGraph {
    return new BlockingGraph(new Map());
  }

  waitsFor(from: TaskId, to: TaskId): boolean {
    const seen = new Set<string>();
    const queue = [from.value];

    while (queue.length > 0) {
      const next = queue.shift();

      if (next === undefined || seen.has(next)) {
        continue;
      }

      seen.add(next);

      for (const blocker of this.blockers.get(next) ?? []) {
        if (blocker.value === to.value) {
          return true;
        }

        queue.push(blocker.value);
      }
    }

    return false;
  }
}
