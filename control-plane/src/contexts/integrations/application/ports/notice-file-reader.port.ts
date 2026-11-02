import type { NoticeFileView } from '@integrations/application/ports/integration-runtime.port';

export const NOTICE_FILE_READER = Symbol('NOTICE_FILE_READER');

export interface NoticeFileReaderPort {
  open(workspaceId: string, file: NoticeFileView): Promise<Uint8Array>;
}
