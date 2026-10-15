import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';

export const MEMORY_WAYS = ['briefed', 'recalled'] as const;

export type MemoryWay = (typeof MEMORY_WAYS)[number];

export const isMemoryWay = (way: string): way is MemoryWay =>
  (MEMORY_WAYS as readonly string[]).includes(way);

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

  with(way: MemoryWay, memories: readonly string[]): RunMemories {
    const held = way === 'briefed' ? this.briefed : this.recalled;

    if (memories.every((each) => held.includes(each))) {
      return this;
    }

    return RunMemories.of({
      briefed: way === 'briefed' ? [...held, ...memories] : this.briefed,
      recalled: way === 'recalled' ? [...held, ...memories] : this.recalled,
    });
  }
}
