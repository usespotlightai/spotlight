import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

export const MEMORY_VIAS = ['briefed', 'recalled'] as const;

export type MemoryVia = (typeof MEMORY_VIAS)[number];

export const isMemoryVia = (via: string): via is MemoryVia =>
  (MEMORY_VIAS as readonly string[]).includes(via);

const inOrder = (memories: readonly string[]): readonly string[] =>
  [...new Set(memories)].sort((one, other) =>
    one < other ? -1 : one > other ? 1 : 0,
  );

export class RunMemories {
  private constructor(
    readonly briefed: readonly string[],
    readonly recalled: readonly string[],
  ) {}

  static readonly NONE = new RunMemories([], []);

  static of(input: {
    briefed: readonly string[];
    recalled: readonly string[];
  }): RunMemories {
    if ([...input.briefed, ...input.recalled].some((each) => !each.trim())) {
      throw new InvalidOutcomeError('must name each memory used');
    }

    return new RunMemories(inOrder(input.briefed), inOrder(input.recalled));
  }

  get used(): boolean {
    return this.briefed.length + this.recalled.length > 0;
  }

  with(via: MemoryVia, memories: readonly string[]): RunMemories {
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
