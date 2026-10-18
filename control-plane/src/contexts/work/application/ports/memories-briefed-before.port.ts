import type {
  BriefedContext,
  BriefingSelection,
} from '@work/application/ports/team-memories.port';

export const MEMORIES_BRIEFED_BEFORE = Symbol('MEMORIES_BRIEFED_BEFORE');

export interface NamedMemory {
  readonly id: string;
  readonly handle: string;
}

export interface MemoriesBriefedBeforePort {
  again(
    briefing: BriefedContext,
    chosen: {
      readonly briefed: readonly NamedMemory[];
      readonly omitted: readonly NamedMemory[];
    },
    asOf: Date,
  ): Promise<BriefingSelection>;
}
