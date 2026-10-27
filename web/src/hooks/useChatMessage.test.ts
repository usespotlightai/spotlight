import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatMessage } from '@/hooks/useChatMessage';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import type { SharedAttachment } from '@/lib/shared-draft';

const uploaded = vi.fn();

vi.mock('@/lib/upload-attachment', () => ({
  uploadAttachment: (input: unknown) => uploaded(input),
}));

const image = () => new File(['png'], 'shot.png', { type: 'image/png' });

const draft = (
  attachments: readonly SharedAttachment[],
  generation: number,
  share: (attachment: SharedAttachment) => void,
): SharedDraft =>
  ({
    attachments,
    generation,
    share,
    unshare: vi.fn(),
  }) as unknown as SharedDraft;

beforeEach(() => {
  uploaded.mockReset();
});

describe('useChatMessage in a shared draft', () => {
  it('hands an upload to the draft once, and does not hand it over again after the draft is sent', async () => {
    uploaded.mockResolvedValue({ id: 'att_1' });
    const shared: SharedAttachment[] = [];
    const share = vi.fn((each: SharedAttachment) => shared.push(each));
    const { result, rerender } = renderHook(
      ({ attachments, generation }) =>
        useChatMessage('acme', [], '', draft(attachments, generation, share)),
      { initialProps: { attachments: [...shared], generation: 0 } },
    );

    act(() => result.current.attach([image()]));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    rerender({ attachments: [...shared], generation: 0 });
    expect(result.current.outgoing.attachments).toEqual(['att_1']);

    rerender({ attachments: [], generation: 1 });
    rerender({ attachments: [], generation: 1 });

    expect(share).toHaveBeenCalledTimes(1);
    expect(result.current.outgoing.attachments).toEqual([]);
    expect(result.current.images).toEqual([]);
  });

  it('sends the image a teammate handed to the draft', () => {
    const { result } = renderHook(() =>
      useChatMessage(
        'acme',
        [],
        '',
        draft(
          [{ key: 'k1', id: 'att_2', name: 'a.png', size: 3, image: true }],
          0,
          vi.fn(),
        ),
      ),
    );

    expect(result.current.outgoing.attachments).toEqual(['att_2']);
    expect(result.current.images.map((each) => each.name)).toEqual(['a.png']);
  });
});
