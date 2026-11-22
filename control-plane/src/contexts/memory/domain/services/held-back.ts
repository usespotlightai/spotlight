import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type {
  UpkeepFinding,
  UpkeepProposalState,
} from '@memory/domain/value-objects/upkeep-change';

export const REJECTION_HOLDS_FOR_MS = 90 * 24 * 60 * 60 * 1000;

const OPEN: readonly UpkeepProposalState[] = ['pending', 'approved'];

export interface UpkeepHistory {
  readonly memoryIds: readonly MemoryId[];
  readonly finding: UpkeepFinding;
  readonly state: UpkeepProposalState;
  readonly decidedAt: Date | null;
}

export class HeldBack {
  private constructor(
    private readonly open: ReadonlySet<string>,
    private readonly rejected: ReadonlyMap<string, ReadonlySet<UpkeepFinding>>,
  ) {}

  static of(input: {
    open: Iterable<MemoryId>;
    rejected: Iterable<{ memoryId: MemoryId; finding: UpkeepFinding }>;
  }): HeldBack {
    const rejected = new Map<string, Set<UpkeepFinding>>();
    for (const { memoryId, finding } of input.rejected) {
      rejected.set(
        memoryId.value,
        (rejected.get(memoryId.value) ?? new Set()).add(finding),
      );
    }

    return new HeldBack(
      new Set([...input.open].map((each) => each.value)),
      rejected,
    );
  }

  static lookbackFrom(now: Date): Date {
    return new Date(now.getTime() - REJECTION_HOLDS_FOR_MS);
  }

  static from(history: readonly UpkeepHistory[], now: Date): HeldBack {
    const since = HeldBack.lookbackFrom(now).getTime();

    return HeldBack.of({
      open: history
        .filter((each) => OPEN.includes(each.state))
        .flatMap((each) => each.memoryIds),
      rejected: history
        .filter(
          (each) =>
            each.state === 'rejected' &&
            each.decidedAt !== null &&
            each.decidedAt.getTime() >= since,
        )
        .flatMap((each) =>
          each.memoryIds.map((memoryId) => ({
            memoryId,
            finding: each.finding,
          })),
        ),
    });
  }

  static none(): HeldBack {
    return HeldBack.of({ open: [], rejected: [] });
  }

  taking(memoryIds: readonly MemoryId[]): HeldBack {
    return new HeldBack(
      new Set([...this.open, ...memoryIds.map((each) => each.value)]),
      this.rejected,
    );
  }

  isOpen(memoryId: MemoryId): boolean {
    return this.open.has(memoryId.value);
  }

  holds(memoryId: MemoryId, finding: UpkeepFinding): boolean {
    return (
      this.isOpen(memoryId) ||
      (this.rejected.get(memoryId.value)?.has(finding) ?? false)
    );
  }
}
