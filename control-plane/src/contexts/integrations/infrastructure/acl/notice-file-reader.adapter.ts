import type { NoticeFileReaderPort } from '@integrations/application/ports/notice-file-reader.port';
import type { NoteFilesPort } from '@work/application/ports/note-files.port';

export class NoticeFileReader implements NoticeFileReaderPort {
  constructor(private readonly files: NoteFilesPort) {}

  open(taskId: string, fileId: string): Promise<Uint8Array | null> {
    return this.files.open(taskId, fileId);
  }
}
