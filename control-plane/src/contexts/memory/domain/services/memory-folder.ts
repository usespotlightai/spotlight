import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemorySite } from '@memory/domain/value-objects/memory-scope.vo';

export const MEMORY_FOLDER = '.spotlight/memory';

export const MEMORY_FILE = /M-\d+\.md/;

const FILE = /(?:^|\/)(M-\d+)\.md$/;

const foldersOf = (memory: Memory): string[] => {
  const { repository, paths, stationId, lineId } = memory.scope;

  if (repository) {
    const at = `${MIRRORING}${repository.owner}/${repository.name}`;
    return paths.length > 0 ? paths.map((each) => `${at}/${each.value}`) : [at];
  }

  if (stationId) {
    return ['station'];
  }

  return [lineId ? 'line' : 'team'];
};

export interface FolderRow {
  readonly folder: string;
  readonly holds: string;
}

const MIRRORING = 'repositories/';

export const mirroringAt = (site: MemorySite): string | null =>
  site.repositories.length > 0 ? MIRRORING : null;

export const layoutAt = (site: MemorySite): FolderRow[] => [
  { folder: 'team/', holds: 'the whole team' },
  ...(site.lineId ? [{ folder: 'line/', holds: 'this line' }] : []),
  ...(site.stationId ? [{ folder: 'station/', holds: 'this station' }] : []),
  ...(site.repositories.length > 0
    ? [
        {
          folder: `${MIRRORING}<owner>/<name>/<path>/`,
          holds: 'a repository, or a file or folder in it',
        },
      ]
    : []),
];

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
