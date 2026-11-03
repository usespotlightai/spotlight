import type { NoticeFileReaderPort } from '@integrations/application/ports/notice-file-reader.port';
import type { NoteFilesPort } from '@work/application/ports/note-files.port';

const owned = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  bytes.buffer instanceof ArrayBuffer
    ? (bytes as Uint8Array<ArrayBuffer>)
    : new Uint8Array(bytes);

export class NoticeFileReader implements NoticeFileReaderPort {
  constructor(private readonly files: NoteFilesPort) {}

  async open(
    taskId: string,
    fileId: string,
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const bytes = await this.files.open(taskId, fileId);

    return bytes ? owned(bytes) : null;
  }
}
