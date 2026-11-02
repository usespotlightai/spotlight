import { Attached } from '@work/application/rendering/attached';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { describe, expect, it } from 'vitest';

describe('Attached', () => {
  it('reads the id from the path a run sees, wherever the workspace is', () => {
    expect(Attached.idIn('.spotlight/attachments/att_1/mockup.png').value).toBe(
      'att_1',
    );
    expect(
      Attached.idIn('/workspace/.spotlight/attachments/att_1/a b.png').value,
    ).toBe('att_1');
  });

  it('takes a bare id as it is', () => {
    expect(Attached.idIn(' att_1 ').value).toBe('att_1');
  });

  it('rejects a path outside the attachments folder', () => {
    expect(() => Attached.idIn('screenshots/mockup.png')).toThrow(
      InvalidAttachmentError,
    );
  });
});
