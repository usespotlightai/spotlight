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

const TEXT = {
  bold: 'font-semibold',
  code: 'rounded bg-[#ececec] px-1 py-0.5 font-mono dark:bg-muted',
  italic: 'italic',
  strikethrough: 'line-through',
};

const SM: EditorThemeClasses = {
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
  text: TEXT,
};

const XS: EditorThemeClasses = {
  code: 'my-1 block overflow-x-auto rounded bg-muted px-1.5 py-1 font-mono text-xs leading-5',
  heading: {
    h1: 'mt-2 font-semibold text-xs leading-5 first:mt-0',
    h2: 'mt-2 font-semibold text-xs leading-5 first:mt-0',
    h3: 'mt-2 font-medium text-xs leading-5 first:mt-0',
  },
  link: 'underline underline-offset-2',
  list: {
    listitem: 'text-xs leading-5',
    nested: { listitem: 'list-none' },
    ol: 'list-decimal pl-4 marker:text-muted-foreground',
    ul: 'list-disc pl-4 marker:text-muted-foreground',
  },
  paragraph: 'text-xs leading-5',
  quote:
    'border-border border-l-2 pl-2 text-muted-foreground text-xs leading-5',
  text: TEXT,
};

const THEMES = { sm: SM, xs: XS };

type MarkdownEditorProps = {
  initialValue: string;
  onChange?: (markdown: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  placeholderClassName?: string;
  size?: keyof typeof THEMES;
};

export function MarkdownEditor({
  initialValue,
  onChange,
  onBlur,
  readOnly,
  placeholder,
  ariaLabel,
  className,
  placeholderClassName,
  size = 'sm',
}: MarkdownEditorProps) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'markdown',
        editable: !readOnly,
        nodes: NODES,
        theme: THEMES[size],
        editorState: () =>
          $convertFromMarkdownString(
            initialValue,
            TRANSFORMERS,
            undefined,
            false,
            Boolean(readOnly),
          ),
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
              onBlur={onBlur}
              aria-placeholder={placeholder}
              placeholder={
                <p
                  className={cn(
                    'pointer-events-none absolute top-3 left-3 text-muted-foreground text-sm',
                    placeholderClassName,
                  )}
                >
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

        {onChange && (
          <OnChangePlugin
            ignoreSelectionChange
            onChange={(state) =>
              state.read(() => onChange($convertToMarkdownString(TRANSFORMERS)))
            }
          />
        )}
      </div>
    </LexicalComposer>
  );
}
