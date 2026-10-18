import {
  type FolderLevel,
  layoutAt,
} from '@memory/domain/services/memory-folder';
import type { RunContext } from '@memory/domain/value-objects/run-context';

export interface FolderRow {
  readonly folder: string;
  readonly level: string;
}

const LEVEL_TEXTS: Record<FolderLevel, string> = {
  team: 'the whole team',
  line: 'this line',
  station: 'this station',
  repository: 'a repository, or a file or folder in it',
};

export const folderLayoutAt = (runContext: RunContext): FolderRow[] =>
  layoutAt(runContext).map((each) => ({
    folder: each.folder,
    level: LEVEL_TEXTS[each.level],
  }));
