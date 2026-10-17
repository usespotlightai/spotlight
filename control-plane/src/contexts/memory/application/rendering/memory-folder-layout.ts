import {
  type FolderLevel,
  layoutAt,
} from '@memory/domain/services/memory-folder';
import type { RunSite } from '@memory/domain/value-objects/run-site';

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

export const folderLayoutAt = (site: RunSite): FolderRow[] =>
  layoutAt(site).map((each) => ({
    folder: each.folder,
    level: LEVEL_TEXTS[each.level],
  }));
