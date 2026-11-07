import type {
  StoredArchive,
  WorkingCopyArchive,
} from '@runs/domain/aggregates/working-copy-archive.aggregate';

export const WORKING_COPY_ARCHIVE_STORE = Symbol('WORKING_COPY_ARCHIVE_STORE');

export interface ArchiveUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface WorkingCopyArchiveStorePort {
  grantUpload(archive: WorkingCopyArchive): Promise<ArchiveUpload>;

  stored(archive: WorkingCopyArchive): Promise<StoredArchive | null>;

  grantDownload(archive: WorkingCopyArchive): Promise<string>;

  remove(archive: WorkingCopyArchive): Promise<void>;
}
