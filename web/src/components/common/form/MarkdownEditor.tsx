import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import type { EditorThemeClasses } from 'lexical';
import { cn } from '@/lib/utils';

const NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
];

const THEME: EditorThemeClasses = {
  code: 'my-2 block overflow-x-auto rounded-md bg-muted p-3 font-mono text-foreground text-xs leading-5',
  heading: {
    h1: 'mt-5 mb-1 font-semibold text-base text-foreground first:mt-0',
    h2: 'mt-5 mb-1 font-semibold text-foreground text-sm first:mt-0',
    h3: 'mt-4 mb-1 font-medium text-foreground text-sm first:mt-0',
  },
  link: 'text-primary underline underline-offset-2',
  list: {
    listitem: 'my-0.5 ml-1 text-foreground text-sm leading-6',
    nested: { listitem: 'list-none' },
    ol: 'my-1 list-decimal pl-5 marker:text-muted-foreground',
    ul: 'my-1 list-disc pl-5 marker:text-muted-foreground',
  },
  paragraph: 'text-foreground text-sm leading-6',
  quote: 'my-2 border-border border-l-2 pl-3 text-muted-foreground text-sm',
  text: {
    bold: 'font-semibold',
    code: 'rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]',
    italic: 'italic',
    strikethrough: 'line-through',
  },
};

type MarkdownEditorProps = {
  initialValue: string;
  onChange: (markdown: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
};

export function MarkdownEditor({
  initialValue,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: MarkdownEditorProps) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'markdown',
        nodes: NODES,
        theme: THEME,
        editorState: () =>
          $convertFromMarkdownString(initialValue, TRANSFORMERS),
        onError: (error) => {
          throw error;
        },
      }}
    >
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-label={ariaLabel}
              aria-placeholder={placeholder}
              placeholder={
                <p className="pointer-events-none absolute top-3 left-3 text-muted-foreground text-sm">
                  {placeholder}
                </p>
              }
              className={cn(
                'w-full rounded-lg border-[0.5px] border-border bg-background p-3 outline-none transition-colors focus-visible:border-input',
                className,
              )}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />

        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <ListPlugin />
        <LinkPlugin />
        <HistoryPlugin />

        <OnChangePlugin
          ignoreSelectionChange
          onChange={(state) =>
            state.read(() => onChange($convertToMarkdownString(TRANSFORMERS)))
          }
        />
      </div>
    </LexicalComposer>
  );
}
