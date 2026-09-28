import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { RunSite } from '@memory/domain/value-objects/run-site';

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

export type FolderHolding = 'team' | 'line' | 'station' | 'repository';

export interface LaidOutFolder {
  readonly folder: string;
  readonly holds: FolderHolding;
}

const MIRRORING = 'repositories/';

export const mirroringAt = (site: RunSite): string | null =>
  site.repositories.length > 0 ? MIRRORING : null;

export const layoutAt = (site: RunSite): LaidOutFolder[] => [
  { folder: 'team/', holds: 'team' },
  ...(site.lineId ? [{ folder: 'line/', holds: 'line' } as const] : []),
  ...(site.stationId
    ? [{ folder: 'station/', holds: 'station' } as const]
    : []),
  ...(site.repositories.length > 0
    ? [
        {
          folder: `${MIRRORING}<owner>/<name>/<path>/`,
          holds: 'repository',
        } as const,
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
