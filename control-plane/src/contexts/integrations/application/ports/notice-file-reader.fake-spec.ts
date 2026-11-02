import type { NoticeFileReaderPort } from '@integrations/application/ports/notice-file-reader.port';

export const noFiles: NoticeFileReaderPort = {
  open: async () => {
    throw new Error('This test opens no file.');
  },
};
