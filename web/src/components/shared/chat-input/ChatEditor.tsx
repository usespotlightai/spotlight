import { HistoryExtension } from '@lexical/history';
import { PlainTextExtension } from '@lexical/plain-text';
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  defineExtension,
  type LexicalEditor,
} from 'lexical';
import { type RefObject, useState } from 'react';

import { EditorHandle } from '@/components/shared/chat-input/EditorHandle';
import {
  $spacedReferences,
  ReferenceNode,
} from '@/components/shared/chat-input/ReferenceNode';
import { SendOnEnter } from '@/components/shared/chat-input/SendOnEnter';
import { SharedWriting } from '@/components/shared/chat-input/SharedWriting';
import { WatchMessage } from '@/components/shared/chat-input/WatchMessage';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SharedDraft } from '@/hooks/useSharedDraft';
import type { Reference, Written } from '@/lib/chat-input';
import { cn } from '@/lib/utils';

type ChatEditorProps = {
  label: string;
  placeholder: string;
  initialReferences: readonly Reference[];
  initialText?: string;
  handle: RefObject<LexicalEditor | null>;
  editable: boolean;
  disabled: boolean;
  onEnter: () => void;
  onWritten: (written: Written) => void;
  shared?: SharedDraft | null;
  cursors?: RefObject<HTMLDivElement | null>;
};

export function ChatEditor({
  label,
  placeholder,
  initialReferences,
  initialText = '',
  handle,
  editable,
  disabled,
  onEnter,
  onWritten,
  shared,
  cursors,
}: ChatEditorProps) {
  const [extension] = useState(() =>
    defineExtension({
      name: '@spotlight/chat-input',
      namespace: 'chat-input',
      nodes: [ReferenceNode],
      dependencies: shared
        ? [PlainTextExtension]
        : [PlainTextExtension, HistoryExtension],
      onError: (error: Error) => {
        throw error;
      },
      $initialEditorState: shared
        ? null
        : initialReferences.length > 0 || initialText
          ? () => {
              const paragraph = $createParagraphNode();
              paragraph.append(...$spacedReferences(initialReferences));
              if (initialText) {
                paragraph.append($createTextNode(initialText));
              }
              $getRoot().append(paragraph);
              paragraph.selectEnd();
            }
          : undefined,
    }),
  );

  return (
    <LexicalCollaboration>
      <LexicalExtensionComposer extension={extension} contentEditable={null}>
        <ScrollArea className="max-h-[min(14rem,25svh)]">
          <ContentEditable
            aria-label={label}
            aria-placeholder={placeholder}
            placeholder={
              <p
                className={cn(
                  'pointer-events-none absolute inset-x-1.5 top-0 truncate text-sm leading-6',
                  disabled ? 'text-faint' : 'text-muted-foreground',
                )}
              >
                {placeholder}
              </p>
            }
            className="whitespace-pre-wrap break-words text-foreground text-sm leading-6 outline-none"
          />
        </ScrollArea>
        {shared ? (
          <>
            <CollaborationPlugin
              id={shared.name}
              providerFactory={(id, docs) => {
                docs.set(id, shared.doc);
                return shared.provider;
              }}
              shouldBootstrap
              username={shared.me.name}
              cursorColor={shared.me.color}
              cursorsContainerRef={cursors}
            />
            <SharedWriting onWrote={shared.wrote} />
          </>
        ) : null}
        <EditorHandle editorRef={handle} editable={editable} />
        <SendOnEnter send={onEnter} />
        <WatchMessage onChange={onWritten} />
      </LexicalExtensionComposer>
    </LexicalCollaboration>
  );
}
