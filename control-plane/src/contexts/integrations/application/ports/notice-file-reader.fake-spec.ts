import type { NoticeFileReaderPort } from '@integrations/application/ports/notice-file-reader.port';

export const noFiles: NoticeFileReaderPort = {
  open: () => {
    return Promise.reject(new Error('This test opens no file.'));
  },
};
