import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachments } from '@/hooks/useAttachments';
import { MAX_ATTACHMENT_BYTES } from '@/lib/attachment';

const uploaded = vi.fn();

vi.mock('@/lib/upload-attachment', () => ({
  uploadAttachment: (input: unknown) => uploaded(input),
}));

const text = () => new File(['notes'], 'notes.txt', { type: 'text/plain' });
const image = () => new File(['png'], 'shot.png', { type: 'image/png' });

beforeEach(() => {
  uploaded.mockReset();
});

describe('useAttachments', () => {
  it('uploads a file the moment it is added, and keeps its id once done', async () => {
    uploaded.mockResolvedValue({ id: 'att_1' });
    const { result } = renderHook(() => useAttachments('acme'));

    act(() => result.current.add([text()]));

    expect(uploaded).toHaveBeenCalledWith({
      slug: 'acme',
      file: expect.any(File),
    });
    expect(result.current.uploading).toBe(true);
    expect(result.current.ids).toEqual([]);

    await waitFor(() => expect(result.current.ids).toEqual(['att_1']));
    expect(result.current.uploading).toBe(false);
  });

  it('keeps a failed upload in view, with nothing to send for it', async () => {
    uploaded.mockRejectedValue(new Error('refused'));
    const { result } = renderHook(() => useAttachments('acme'));

    act(() => result.current.add([text()]));

    await waitFor(() =>
      expect(result.current.attachments[0]).toMatchObject({
        state: 'failed',
        problem: 'Upload failed',
      }),
    );
    expect(result.current.ids).toEqual([]);
  });

  it('never uploads a file larger than the limit', () => {
    const { result } = renderHook(() => useAttachments('acme'));
    const large = text();
    Object.defineProperty(large, 'size', { value: MAX_ATTACHMENT_BYTES + 1 });

    act(() => result.current.add([large]));

    expect(uploaded).not.toHaveBeenCalled();
    expect(result.current.attachments[0]).toMatchObject({
      state: 'failed',
      problem: 'The file is too large. Maximum size: 25 MB',
    });
  });

  it('keeps an image to preview, and nothing to preview for other files', () => {
    uploaded.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAttachments('acme'));
    const picture = image();

    act(() => result.current.add([picture, text()]));

    const [shot, notes] = result.current.attachments;
    expect(shot?.image).toBe(picture);
    expect(notes?.image).toBeNull();

    act(() => result.current.remove(shot?.key ?? ''));

    expect(result.current.attachments).toHaveLength(1);
  });

  it('forgets a file removed while it was still going up', async () => {
    let land: (granted: { id: string }) => void = () => {};
    uploaded.mockReturnValue(
      new Promise((resolve) => {
        land = resolve;
      }),
    );
    const { result } = renderHook(() => useAttachments('acme'));

    act(() => result.current.add([text()]));
    act(() => result.current.clear());
    await act(async () => land({ id: 'att_1' }));

    expect(result.current.attachments).toEqual([]);
    expect(result.current.ids).toEqual([]);
  });
});
