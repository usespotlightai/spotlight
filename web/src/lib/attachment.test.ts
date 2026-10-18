import { describe, expect, it } from 'vitest';
import {
  attachmentPath,
  downloadPath,
  drawn,
  filesIn,
  MAX_ATTACHMENT_BYTES,
  sized,
  sizeProblem,
} from '@/lib/attachment';

describe('attachmentPath', () => {
  it('addresses the file within its workspace', () => {
    expect(attachmentPath('acme', 'att_1')).toBe(
      '/api/workspaces/acme/attachments/att_1',
    );
  });

  it('requests a download rather than a look', () => {
    expect(downloadPath('acme', 'att_1')).toBe(
      '/api/workspaces/acme/attachments/att_1?download=1',
    );
  });
});

describe('drawn', () => {
  it('draws what a browser can show', () => {
    expect(drawn('image/png')).toBe(true);
    expect(drawn('image/svg+xml')).toBe(true);
  });

  it('leaves an image it cannot show as a file', () => {
    expect(drawn('image/heic')).toBe(false);
    expect(drawn('application/pdf')).toBe(false);
  });
});

describe('sized', () => {
  it('counts a small file in bytes', () => {
    expect(sized(512)).toBe('512 B');
  });

  it('keeps a decimal only below ten', () => {
    expect(sized(1_536)).toBe('1.5 KB');
    expect(sized(20 * 1024 + 300)).toBe('20 KB');
    expect(sized(MAX_ATTACHMENT_BYTES)).toBe('25 MB');
  });
});

describe('sizeProblem', () => {
  it('takes a file up to the limit', () => {
    expect(sizeProblem({ size: MAX_ATTACHMENT_BYTES })).toBeNull();
  });

  it('says why a larger one is rejected', () => {
    expect(sizeProblem({ size: MAX_ATTACHMENT_BYTES + 1 })).toBe(
      'The file is too large. Maximum size: 25 MB',
    );
  });
});

describe('filesIn', () => {
  it('finds nothing where nothing was carried', () => {
    expect(filesIn(null)).toEqual([]);
  });

  it('finds the files a drop or a paste carried', () => {
    const file = new File(['x'], 'notes.txt');

    expect(filesIn({ files: [file] } as unknown as DataTransfer)).toEqual([
      file,
    ]);
  });
});
