import type { NoticeFileDto } from '@work/application/dto/notice-file.dto';

export const NOTICE_FILES = Symbol('NOTICE_FILES');

export interface NoticeFilesPort {
  open(workspaceId: string, file: NoticeFileDto): Promise<Uint8Array>;
}
