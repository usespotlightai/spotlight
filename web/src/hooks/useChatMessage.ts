import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import {
  type ClipboardEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { $spacedReferences } from '@/components/shared/chat-input/ReferenceNode';
import { DRAFT_SENT } from '@/components/shared/chat-input/SharedWriting';
import { useAttachments } from '@/hooks/useAttachments';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import {
  allowFileDrop,
  dropFiles,
  type PendingAttachment,
  pasteFiles,
} from '@/lib/attachment';
import {
  type Outgoing,
  type Reference,
  targetStationIdIn,
  type Written,
} from '@/lib/chat-input';

// Keeps the first paragraph and empties it, so writers who clear at the same time delete the same nodes and add none.
const $clearDraft = () => {
  const [first, ...rest] = $getRoot().getChildren();

  for (const each of rest) {
    each.remove();
  }

  if ($isElementNode(first)) {
    first.clear();
  } else {
    first?.remove();
    $getRoot().append($createParagraphNode());
  }
};

export function useChatMessage(
  slug: string,
  initialReferences: readonly Reference[],
  initialText = '',
  shared: SharedDraft | null = null,
) {
  const [handedOver, setHandedOver] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const draft = useAttachments(slug, (ready) => {
    if (!shared) {
      return;
    }

    shared.share({
      key: ready.key,
      id: ready.id,
      name: ready.name,
      size: ready.size,
      image: ready.image !== null,
    });
    setHandedOver((all) => new Set([...all, ready.key]));
  });
  const editor = useRef<LexicalEditor | null>(null);
  const [written, setWritten] = useState<Written>(() => ({
    text: initialText,
    references: initialReferences,
  }));
  const sharedAttachments = shared?.attachments;
  const generation = shared?.generation;
  const synced = shared?.synced;
  const sentText = shared?.sentText;
  const seen = useRef({ generation: 0, synced: false });
  const clearSent = useCallback((body: string) => {
    editor.current?.update(
      () => {
        if ($getRoot().getTextContent().trim() === body) {
          $clearDraft();
        }
      },
      { tag: DRAFT_SENT },
    );
  }, []);

  const placed = new Set(
    written.references.flatMap((each) =>
      each.kind === 'file' ? [each.key] : [],
    ),
  );
  const traced = written.references.filter((each) => each.kind === 'trace');
  const { attachments, pictured } = useMemo(() => {
    const files = new Map(draft.attachments.map((each) => [each.key, each]));
    const theirs = sharedAttachments ?? [];

    return {
      attachments: [
        ...draft.attachments.filter((each) => !handedOver.has(each.key)),
        ...theirs.map(
          (each): PendingAttachment => ({
            key: each.key,
            name: each.name,
            size: each.size,
            image: files.get(each.key)?.image ?? null,
            state: 'ready',
            id: each.id,
          }),
        ),
      ],
      pictured: new Set(
        theirs.flatMap((each) => (each.image ? [each.key] : [])),
      ),
    };
  }, [draft.attachments, sharedAttachments, handedOver]);
  const shown = (each: PendingAttachment) =>
    each.image !== null || pictured.has(each.key);
  const included = attachments.filter(
    (each) => shown(each) || placed.has(each.key),
  );

  // A new generation means the draft was sent: every writer clears the sent text, so it goes even when the sender's tab closed.
  useEffect(() => {
    if (generation === undefined) {
      return;
    }

    if (seen.current.synced && seen.current.generation !== generation) {
      clearSent(sentText ?? '');
    }
    seen.current = { generation, synced: synced ?? false };
  }, [generation, synced, sentText, clearSent]);

  const outgoing: Outgoing = {
    body: written.text.trim(),
    attachments: included.flatMap((each) =>
      each.state === 'ready' ? [each.id] : [],
    ),
    traces: traced.map((each) => each.key),
    targetStation: targetStationIdIn(written.references),
  };

  const states = useMemo(
    () => new Map(attachments.map((each) => [each.key, each])),
    [attachments],
  );

  const attach = (picked: readonly File[]) => {
    const added = draft.add(picked).filter((each) => each.image === null);

    if (added.length === 0) {
      return;
    }

    editor.current?.update(() => {
      const selection = $getSelection();
      const nodes = $spacedReferences(
        added.map((each) => ({ kind: 'file', key: each.key, name: each.name })),
      );

      if ($isRangeSelection(selection)) {
        selection.insertNodes(nodes);
      } else {
        $getRoot().selectEnd().insertNodes(nodes);
      }
    });
  };

  const clear = () => {
    editor.current?.update(
      () => {
        $getRoot().clear().append($createParagraphNode());
      },
      { tag: DRAFT_SENT },
    );
    draft.clear();
  };

  return {
    editor,
    written,
    setWritten,
    outgoing,
    blank:
      !outgoing.body &&
      outgoing.attachments.length === 0 &&
      outgoing.traces.length === 0 &&
      outgoing.targetStation === null,
    uploading: included.some((each) => each.state === 'uploading'),
    images: attachments.filter(shown),
    states,
    attach,
    clear,
    clearSent,
    remove: (key: string) => {
      if (handedOver.has(key)) {
        shared?.unshare(key);
      }
      draft.remove(key);
    },
    handlers: {
      onDragOver: allowFileDrop,
      onDropCapture: (event: DragEvent) => dropFiles(event, attach),
      onPasteCapture: (event: ClipboardEvent) => pasteFiles(event, attach),
    },
  };
}
