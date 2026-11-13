import { Attached } from '@work/application/rendering/attached';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
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

  it('tells the agent once how to see attached videos', () => {
    const listed = (...contentTypes: string[]) =>
      Attached.listed(
        contentTypes.map((contentType, at) =>
          Attachment.of({
            id: `att_${at}`,
            name: 'clip',
            contentType,
            size: 2048,
          }),
        ),
      ) ?? '';

    expect(listed('image/png', 'video/mp4')).toContain('ffmpeg');
    expect(listed('video/mp4', 'video/webm').split('ffprobe')).toHaveLength(2);
    expect(listed('image/png')).not.toContain('ffmpeg');
  });

  it('rejects a path outside the attachments folder', () => {
    expect(() => Attached.idIn('screenshots/mockup.png')).toThrow(
      InvalidAttachmentError,
    );
  });
});
