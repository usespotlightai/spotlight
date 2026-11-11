import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

const MEMORY_VIAS = ['briefed', 'recalled'] as const;

export type MemoryVia = (typeof MEMORY_VIAS)[number];

export const isMemoryVia = (via: string): via is MemoryVia =>
  (MEMORY_VIAS as readonly string[]).includes(via);

export type MemoryReference = string & {
  readonly brand: 'memory-reference';
};

export const MemoryReference = {
  of(raw: string): MemoryReference {
    if (!raw.trim()) {
      throw new InvalidOutcomeError('must name each memory used');
    }

    return raw as MemoryReference;
  },
};

const inOrder = (
  memories: readonly MemoryReference[],
): readonly MemoryReference[] =>
  [...new Set(memories)].sort((one, other) =>
    one < other ? -1 : one > other ? 1 : 0,
  );

export class RunMemories {
  private constructor(
    readonly briefed: readonly MemoryReference[],
    readonly recalled: readonly MemoryReference[],
  ) {}

  static readonly NONE = new RunMemories([], []);

  static of(input: {
    briefed: readonly string[];
    recalled: readonly string[];
  }): RunMemories {
    return new RunMemories(
      inOrder(input.briefed.map(MemoryReference.of)),
      inOrder(input.recalled.map(MemoryReference.of)),
    );
  }

  get used(): boolean {
    return this.briefed.length + this.recalled.length > 0;
  }

  with(via: MemoryVia, memories: readonly MemoryReference[]): RunMemories {
    const known = via === 'briefed' ? this.briefed : this.recalled;

    if (memories.every((each) => known.includes(each))) {
      return this;
    }

    return RunMemories.of({
      briefed: via === 'briefed' ? [...known, ...memories] : this.briefed,
      recalled: via === 'recalled' ? [...known, ...memories] : this.recalled,
    });
  }
}
