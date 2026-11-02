import type { NoticeFileView } from '@integrations/application/ports/integration-runtime.port';
import type { NoticeFileReaderPort } from '@integrations/application/ports/notice-file-reader.port';
import type { NoticeFilesPort } from '@work/application/ports/notice-files.port';

export class NoticeFileReader implements NoticeFileReaderPort {
  constructor(private readonly files: NoticeFilesPort) {}

  open(workspaceId: string, file: NoticeFileView): Promise<Uint8Array> {
    return this.files.open(workspaceId, file);
  }
}
