import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';

export const MEMORY_FOLDER = '.spotlight/memory';

export const REPOSITORY_FOLDER = 'repositories/';

const FILE = /(?:^|\/)(M-\d+)\.md$/;

const foldersOf = (memory: Memory): string[] => {
  const { repository, paths, stationId, lineId } = memory.scope;

  if (repository) {
    const at = `${REPOSITORY_FOLDER}${repository.owner}/${repository.name}`;
    return paths.length > 0 ? paths.map((each) => `${at}/${each.value}`) : [at];
  }

  if (stationId) {
    return ['station'];
  }

  return [lineId ? 'line' : 'team'];
};

export const laysOutFolder = (counted: {
  readonly applying: number;
  readonly briefed: number;
}): boolean => counted.applying > 0 || counted.briefed > 0;

export const filesOf = (memory: Memory): string[] =>
  foldersOf(memory).map(
    (folder) => `${MEMORY_FOLDER}/${folder}/${memory.handle.value}.md`,
  );

export const handlesRead = (referenced: readonly string[]): MemoryHandle[] => {
  const numbers = new Set<number>();

  for (const each of referenced) {
    const within = each.slice(each.indexOf(MEMORY_FOLDER));
    const named = FILE.exec(within)?.[1];

    if (within.startsWith(MEMORY_FOLDER) && named) {
      try {
        numbers.add(MemoryHandle.parse(named).number);
      } catch (error) {
        if (!(error instanceof InvalidMemoryError)) {
          throw error;
        }
      }
    }
  }

  return [...numbers].map((number) => MemoryHandle.of(number));
};
