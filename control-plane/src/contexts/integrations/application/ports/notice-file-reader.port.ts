export const NOTICE_FILE_READER = Symbol('NOTICE_FILE_READER');

export interface NoticeFileReaderPort {
  open(taskId: string, fileId: string): Promise<Uint8Array | null>;
}
