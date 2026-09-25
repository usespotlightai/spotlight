import type {
  StoredArchive,
  WorkspaceArchive,
} from '@work/domain/aggregates/workspace-archive.aggregate';

export const WORKSPACE_ARCHIVE_STORE = Symbol('WORKSPACE_ARCHIVE_STORE');

export interface ArchiveUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface WorkspaceArchiveStorePort {
  grantUpload(archive: WorkspaceArchive): Promise<ArchiveUpload>;

  stored(archive: WorkspaceArchive): Promise<StoredArchive | null>;

  grantDownload(archive: WorkspaceArchive): Promise<string>;

  remove(archive: WorkspaceArchive): Promise<void>;
}
