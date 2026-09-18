import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAttachments } from '@/hooks/useAttachments';
import { MAX_ATTACHMENT_BYTES } from '@/lib/attachment';

const uploaded = vi.fn();

vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({ mutateAsync: uploaded }),
}));

const text = () => new File(['notes'], 'notes.txt', { type: 'text/plain' });
const image = () => new File(['png'], 'shot.png', { type: 'image/png' });

beforeEach(() => {
  uploaded.mockReset();
});

describe('useAttachments', () => {
  it('uploads a file the moment it is added, and holds its id once done', async () => {
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
      problem: 'Larger than 25 MB',
    });
  });

  it('previews an image, and lets the preview go with the file', () => {
    uploaded.mockReturnValue(new Promise(() => {}));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    const { result } = renderHook(() => useAttachments('acme'));

    act(() => result.current.add([image(), text()]));

    const [shot, notes] = result.current.attachments;
    expect(shot?.preview).toBe('blob:preview');
    expect(notes?.preview).toBeNull();

    act(() => result.current.remove(shot?.key ?? ''));

    expect(revoked).toHaveBeenCalledWith('blob:preview');
    expect(result.current.attachments).toHaveLength(1);
  });

  it('lets the previews go when it is done with', () => {
    uploaded.mockReturnValue(new Promise(() => {}));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    const { result, unmount } = renderHook(() => useAttachments('acme'));

    act(() => result.current.add([image()]));
    unmount();

    expect(revoked).toHaveBeenCalledWith('blob:preview');
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
