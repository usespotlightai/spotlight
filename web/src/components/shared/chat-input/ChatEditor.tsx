import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical';
import { type RefObject, useState } from 'react';
import { EditorHandle } from '@/components/shared/chat-input/EditorHandle';
import {
  $spacedReferences,
  ReferenceNode,
} from '@/components/shared/chat-input/ReferenceNode';
import { SendOnEnter } from '@/components/shared/chat-input/SendOnEnter';
import { WatchMessage } from '@/components/shared/chat-input/WatchMessage';
import type { Reference, Written } from '@/lib/chat-input';
import { cn } from '@/lib/utils';

type ChatEditorProps = {
  label: string;
  placeholder: string;
  initialReferences: readonly Reference[];
  handle: RefObject<LexicalEditor | null>;
  editable: boolean;
  disabled: boolean;
  onEnter: () => void;
  onWritten: (written: Written) => void;
};

export function ChatEditor({
  label,
  placeholder,
  initialReferences,
  handle,
  editable,
  disabled,
  onEnter,
  onWritten,
}: ChatEditorProps) {
  const [initialConfig] = useState(() => ({
    namespace: 'chat-input',
    nodes: [ReferenceNode],
    onError: (error: Error) => {
      throw error;
    },
    editorState:
      initialReferences.length > 0
        ? () => {
            const paragraph = $createParagraphNode();
            paragraph.append(...$spacedReferences(initialReferences));
            $getRoot().append(paragraph);
          }
        : undefined,
  }));

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={
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
            className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-foreground text-sm leading-6 outline-none"
          />
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <EditorHandle handle={handle} editable={editable} />
      <SendOnEnter send={onEnter} />
      <WatchMessage onChange={onWritten} />
    </LexicalComposer>
  );
}
