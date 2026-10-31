import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatDraft } from '@/hooks/useChatDraft';
import { UPLOAD_MAX_AGE_MS } from '@/lib/chat-draft';
import { toast } from '@/lib/toast';

const STORAGE = 'spotlight.chat-drafts.acme';

const stored = () => JSON.parse(localStorage.getItem(STORAGE) ?? '{}');

const attachment = (uploadedAt = Date.now()) => ({
  key: 'k1',
  id: 'att_1',
  name: 'agent.json',
  size: 2,
  image: false,
  uploadedAt,
  thumbnail: null,
});

const flushed = () => act(() => vi.advanceTimersByTime(500));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useChatDraft', () => {
  it('saves after the debounce, not before', () => {
    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    act(() => result.current.save({ text: 'Plan it', references: [] }));

    expect(localStorage.getItem(STORAGE)).toBeNull();

    flushed();

    expect(stored().new.text).toBe('Plan it');
  });

  it('restores the draft for the next mount', () => {
    const first = renderHook(() => useChatDraft('acme', 'new', ''));
    act(() =>
      first.result.current.save({
        text: 'Plan it',
        references: [{ kind: 'trace', key: 't1', name: 'Trace' }],
        attachments: [attachment()],
        model: 'opus',
      }),
    );
    first.unmount();

    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    expect(result.current.content).toEqual({
      text: 'Plan it',
      references: [{ kind: 'trace', key: 't1', name: 'Trace' }],
      attachments: [attachment()],
    });
    expect(result.current.settings.model).toBe('opus');
  });

  it('flushes on pagehide', () => {
    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    act(() => result.current.save({ text: 'Plan it' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(stored().new.text).toBe('Plan it');
  });

  it('keeps a draft per key and per workspace', () => {
    const save = (slug: string, key: string, text: string) => {
      const { result, unmount } = renderHook(() => useChatDraft(slug, key, ''));
      act(() => result.current.save({ text }));
      unmount();
    };
    save('acme', 'chat:a', 'for a');
    save('acme', 'chat:b', 'for b');
    save('other', 'chat:a', 'elsewhere');

    const text = (slug: string, key: string) =>
      renderHook(() => useChatDraft(slug, key, '')).result.current.content
        ?.text;

    expect(text('acme', 'chat:a')).toBe('for a');
    expect(text('acme', 'chat:b')).toBe('for b');
    expect(text('other', 'chat:a')).toBe('elsewhere');
    expect(text('acme', 'new')).toBeUndefined();
  });

  it('empties the content on discard and keeps the settings', () => {
    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    act(() =>
      result.current.save({
        text: 'Plan it',
        attachments: [attachment()],
        effort: 'high',
      }),
    );
    act(() => result.current.discard());

    expect(stored().new).toMatchObject({
      text: '',
      attachments: [],
      effort: 'high',
    });
  });

  it('removes the record where nothing is left to keep', () => {
    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    act(() => result.current.save({ text: 'Plan it' }));
    flushed();
    act(() => result.current.save({ text: '', references: [] }));
    flushed();

    expect(stored()).toEqual({});
  });

  it('replaces the content, not the settings, where the prefill differs', () => {
    const first = renderHook(() => useChatDraft('acme', 'new', 'one'));
    act(() => first.result.current.save({ text: 'Mine', model: 'opus' }));
    first.unmount();

    const { result } = renderHook(() => useChatDraft('acme', 'new', 'two'));

    expect(result.current.content).toBeNull();
    expect(result.current.fresh).toBe(true);
    expect(result.current.settings.model).toBe('opus');
  });

  it('keeps the edited draft where the prefill is the same', () => {
    const first = renderHook(() => useChatDraft('acme', 'new', 'one'));
    act(() => first.result.current.save({ text: 'Edited' }));
    first.unmount();

    const { result } = renderHook(() => useChatDraft('acme', 'new', 'one'));

    expect(result.current.content?.text).toBe('Edited');
    expect(result.current.fresh).toBe(false);
  });

  it('drops an attachment older than the upload life and says so', () => {
    const add = vi.spyOn(toast, 'add');
    const first = renderHook(() => useChatDraft('acme', 'new', ''));
    act(() =>
      first.result.current.save({
        text: 'Plan it',
        attachments: [attachment(Date.now() - UPLOAD_MAX_AGE_MS - 1)],
      }),
    );
    first.unmount();

    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    expect(result.current.content?.attachments).toEqual([]);
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'agent.json' }),
    );
  });

  it('ignores a corrupt record', () => {
    localStorage.setItem(STORAGE, '{broken');

    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    expect(result.current.content).toBeNull();
  });

  it('never throws where storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useChatDraft('acme', 'new', ''));

    expect(() => {
      act(() => result.current.save({ text: 'Plan it' }));
      flushed();
      act(() => result.current.discard());
    }).not.toThrow();
  });
});
