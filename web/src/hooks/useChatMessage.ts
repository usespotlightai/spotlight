import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
} from 'lexical';
import { useMemo, useRef, useState } from 'react';
import { $spacedReferences } from '@/components/shared/chat-input/ReferenceNode';
import { useAttachments } from '@/hooks/useAttachments';
import {
  type Outgoing,
  type Reference,
  stationImprovedBy,
  type Written,
} from '@/lib/chat-input';

export function useChatMessage(
  slug: string,
  initialReferences: readonly Reference[],
  initialText = '',
) {
  const draft = useAttachments(slug);
  const editor = useRef<LexicalEditor | null>(null);
  const [written, setWritten] = useState<Written>(() => ({
    text: initialText,
    references: initialReferences,
  }));

  const placed = new Set(
    written.references.flatMap((each) =>
      each.kind === 'file' ? [each.key] : [],
    ),
  );
  const traced = written.references.filter((each) => each.kind === 'trace');
  const included = draft.attachments.filter(
    (each) => each.image !== null || placed.has(each.key),
  );

  const outgoing: Outgoing = {
    body: written.text.trim(),
    attachments: included.flatMap((each) =>
      each.state === 'ready' ? [each.id] : [],
    ),
    traces: traced.map((each) => each.key),
    improving: stationImprovedBy(written.references),
  };

  const states = useMemo(
    () => new Map(draft.attachments.map((each) => [each.key, each])),
    [draft.attachments],
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
    editor.current?.update(() => {
      $getRoot().clear().append($createParagraphNode());
    });
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
      outgoing.improving === null,
    uploading: included.some((each) => each.state === 'uploading'),
    images: draft.attachments.filter((each) => each.image !== null),
    states,
    attach,
    clear,
    remove: draft.remove,
    handlers: draft.handlersFor(attach),
  };
}
