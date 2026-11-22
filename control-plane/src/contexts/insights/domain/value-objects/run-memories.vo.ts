import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

const MEMORY_VIAS = [
  'briefed',
  'cut',
  'read',
  'recalled',
  'delivered',
] as const;

export type MemoryVia = (typeof MEMORY_VIAS)[number];

export type UsedVia = Exclude<MemoryVia, 'cut'>;

export const USED: readonly UsedVia[] = MEMORY_VIAS.filter(
  (via): via is UsedVia => via !== 'cut',
);

const LOOKED_UP: readonly MemoryVia[] = [
  'read',
  'recalled',
  'delivered',
];

export type RunDriver = 'line' | 'person';

export const recordsCuts = (driver: RunDriver): boolean => driver === 'line';

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

type ByVia<T> = { readonly [via in MemoryVia]: T };

export class RunMemories {
  private constructor(
    private readonly byVia: ByVia<readonly MemoryReference[]>,
  ) {}

  static readonly NONE = new RunMemories({
    briefed: [],
    cut: [],
    read: [],
    recalled: [],
    delivered: [],
  });

  static of(input: ByVia<readonly string[]>): RunMemories {
    return new RunMemories({
      briefed: inOrder(input.briefed.map((raw) => MemoryReference.of(raw))),
      cut: inOrder(input.cut.map((raw) => MemoryReference.of(raw))),
      read: inOrder(input.read.map((raw) => MemoryReference.of(raw))),
      recalled: inOrder(input.recalled.map((raw) => MemoryReference.of(raw))),
      delivered: inOrder(input.delivered.map((raw) => MemoryReference.of(raw))),
    });
  }

  get briefed(): readonly MemoryReference[] {
    return this.byVia.briefed;
  }

  get cut(): readonly MemoryReference[] {
    return this.byVia.cut;
  }

  get read(): readonly MemoryReference[] {
    return this.byVia.read;
  }

  get recalled(): readonly MemoryReference[] {
    return this.byVia.recalled;
  }

  get delivered(): readonly MemoryReference[] {
    return this.byVia.delivered;
  }

  get cutThenRead(): readonly MemoryReference[] {
    return this.byVia.cut.filter((memory) =>
      LOOKED_UP.some((via) => this.byVia[via].includes(memory)),
    );
  }

  get used(): boolean {
    return USED.some((via) => this.byVia[via].length > 0);
  }

  with(via: MemoryVia, memories: readonly MemoryReference[]): RunMemories {
    const known = this.byVia[via];

    if (memories.every((each) => known.includes(each))) {
      return this;
    }

    return RunMemories.of({ ...this.byVia, [via]: [...known, ...memories] });
  }
}
