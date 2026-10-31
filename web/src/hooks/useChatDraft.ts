import { captureException } from '@sentry/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readStored, writeStored } from '@/hooks/useStoredState';
import {
  CHAT_DRAFTS_KEY,
  type ChatDraft,
  type DraftAttachment,
  type DraftSettings,
  expiredUploads,
  isEmptyDraft,
  parseDrafts,
  pruneDrafts,
  withoutContent,
} from '@/lib/chat-draft';
import type { Reference } from '@/lib/chat-input';
import { toast } from '@/lib/toast';

type DraftContent = {
  readonly text: string;
  readonly references: readonly Reference[];
  readonly attachments: readonly DraftAttachment[];
};

type DraftPatch = Partial<DraftContent> & DraftSettings;

export type DraftHandle = {
  readonly content: DraftContent | null;
  readonly fresh: boolean;
  readonly settings: DraftSettings;
  readonly save: (patch: DraftPatch) => void;
  readonly discard: () => void;
};

const DEBOUNCE_MS = 500;

let reported = false;

const blank = (prefill: string): ChatDraft => ({
  text: '',
  references: [],
  attachments: [],
  savedAt: 0,
  prefill,
});

const persist = (storageKey: string, draftKey: string, draft: ChatDraft) => {
  const now = Date.now();
  const { [draftKey]: _, ...others } = parseDrafts(readStored(storageKey));
  const next = pruneDrafts(
    isEmptyDraft(draft)
      ? others
      : { ...others, [draftKey]: { ...draft, savedAt: now } },
    now,
  );
  const value = JSON.stringify(next);

  writeStored(storageKey, value);

  if (!reported && readStored(storageKey) !== value) {
    reported = true;
    captureException(new Error('Chat draft storage failed'));
  }
};

export function useChatDraft(
  slug: string,
  draftKey: string,
  prefill: string,
): DraftHandle {
  const storageKey = `${CHAT_DRAFTS_KEY}.${slug}`;
  const [start] = useState(() => {
    const saved = parseDrafts(readStored(storageKey))[draftKey];
    const resumed = saved !== undefined && saved.prefill === prefill;
    const { kept, expired } = expiredUploads(
      resumed ? saved.attachments : [],
      Date.now(),
    );
    const gone = new Set(expired.map((each) => each.key));
    const draft = resumed
      ? {
          ...saved,
          attachments: kept,
          references: saved.references.filter(
            (each) => each.kind !== 'file' || !gone.has(each.key),
          ),
        }
      : saved
        ? { ...withoutContent(saved), prefill }
        : blank(prefill);

    return {
      draft,
      expired,
      content: resumed
        ? {
            text: draft.text,
            references: draft.references,
            attachments: kept,
          }
        : null,
    };
  });
  const current = useRef(start.draft);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);

    if (dirty.current) {
      dirty.current = false;
      persist(storageKey, draftKey, current.current);
    }
  }, [storageKey, draftKey]);

  const save = useCallback(
    (patch: DraftPatch) => {
      current.current = { ...current.current, ...patch };
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush],
  );

  const discard = useCallback(() => {
    current.current = withoutContent(current.current);
    dirty.current = true;
    flush();
  }, [flush]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);

    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (start.expired.length > 0) {
      toast.add({
        type: 'warning',
        title: 'Some attachments expired and were removed',
        description: start.expired.map((each) => each.name).join(', '),
      });
    }
  }, [start.expired]);

  return useMemo(
    () => ({
      content: start.content,
      fresh: start.content === null,
      settings: start.draft,
      save,
      discard,
    }),
    [start, save, discard],
  );
}
