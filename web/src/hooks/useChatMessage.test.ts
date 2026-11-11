import { act, renderHook, waitFor } from '@testing-library/react';
import type { LexicalEditor } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatMessage } from '@/hooks/useChatMessage';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import type { SharedAttachment } from '@/lib/shared-draft';

const uploaded = vi.fn<(...args: unknown[]) => unknown>();

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

const synced = (name: string, generation: number, isSynced: boolean) =>
  ({
    name,
    generation,
    synced: isSynced,
    sentText: 'Cap the retries at 500.',
    attachments: [],
    share: vi.fn(),
    unshare: vi.fn(),
  }) as unknown as SharedDraft;

const watched = (shared: SharedDraft) => {
  const update = vi.fn();
  const hook = renderHook(
    ({ shared }) => useChatMessage('acme', [], '', shared),
    { initialProps: { shared } },
  );
  hook.result.current.editor.current = { update } as unknown as LexicalEditor;

  return { ...hook, update };
};

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
    expect(result.current.images[0]?.imageSource).toEqual({
      url: '/api/workspaces/acme/attachments/att_2',
    });
  });
});

describe('useChatMessage clearing a sent draft', () => {
  it('clears the draft when it is sent', () => {
    const { rerender, update } = watched(synced('task-draft:a', 3, true));

    rerender({ shared: synced('task-draft:a', 4, true) });

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('leaves the next draft alone after a switch from a sent draft', () => {
    const { rerender, update } = watched(synced('task-draft:a', 3, true));

    rerender({ shared: synced('task-draft:b', 0, false) });
    rerender({ shared: synced('task-draft:b', 2, true) });

    expect(update).not.toHaveBeenCalled();
  });
});
