import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { HistoryExtension } from '@lexical/history';
import {
  AutoLinkExtension,
  AutoLinkNode,
  ClickableLinkExtension,
  createLinkMatcherWithRegExp,
  LinkExtension,
  LinkNode,
} from '@lexical/link';
import { ListExtension, ListItemNode, ListNode } from '@lexical/list';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { HeadingNode, QuoteNode, RichTextExtension } from '@lexical/rich-text';
import {
  TableCellNode,
  TableExtension,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  configExtension,
  defineExtension,
  type EditorThemeClasses,
} from 'lexical';
import { useState } from 'react';

import { useShownMarkdown } from '@/hooks/useShownMarkdown';
import { MARKDOWN } from '@/lib/markdown-table';
import { cn } from '@/lib/utils';

const NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
];

const URL_MATCHERS = [
  createLinkMatcherWithRegExp(/https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/),
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
    h1: 'mt-5 mb-1 font-medium text-base text-foreground first:mt-0',
    h2: 'mt-5 mb-1 font-medium text-foreground text-sm first:mt-0',
    h3: 'mt-4 mb-1 font-medium text-foreground text-sm first:mt-0',
  },
  link: 'text-primary underline underline-offset-2',
  list: {
    listitem: 'my-0.5 ml-1 text-foreground text-sm leading-5',
    nested: { listitem: 'list-none' },
    ol: 'my-1 list-decimal pl-5 marker:text-muted-foreground',
    ul: 'my-1 list-disc pl-5 marker:text-muted-foreground',
  },
  paragraph: 'text-foreground text-sm leading-5',
  quote: 'my-2 border-border border-l-2 pl-3 text-muted-foreground text-sm',
  table: 'border-collapse text-sm',
  tableCell:
    'border-[0.5px] border-border px-2 py-1 text-left align-top font-normal',
  tableCellHeader: 'bg-muted font-medium',
  tableScrollableWrapper: 'my-2 overflow-x-auto',
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
  table: 'border-collapse text-xs',
  tableCell:
    'border-[0.5px] border-border px-1.5 py-0.5 text-left align-top font-normal',
  tableCellHeader: 'bg-muted font-medium',
  tableScrollableWrapper: 'my-1 overflow-x-auto',
  text: TEXT,
};

const THEMES = { sm: SM, xs: XS };

type ShownTextProps = {
  value: string;
  shortLines: boolean;
};

function ShownText({ value, shortLines }: ShownTextProps) {
  useShownMarkdown(value, shortLines);

  return null;
}

type MarkdownEditorProps = {
  initialValue: string;
  onChange?: (markdown: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  keepLineBreaks?: boolean;
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
  keepLineBreaks,
  placeholder,
  ariaLabel,
  className,
  placeholderClassName,
  size = 'sm',
}: MarkdownEditorProps) {
  const [extension] = useState(() =>
    defineExtension({
      name: '@spotlight/markdown',
      namespace: 'markdown',
      editable: !readOnly,
      nodes: NODES,
      theme: THEMES[size],
      dependencies: [
        RichTextExtension,
        ListExtension,
        LinkExtension,
        configExtension(AutoLinkExtension, { matchers: URL_MATCHERS }),
        configExtension(ClickableLinkExtension, { newTab: true }),
        HistoryExtension,
        configExtension(TableExtension, {
          hasCellMerge: false,
          hasCellBackgroundColor: false,
          hasTabHandler: !readOnly,
        }),
      ],
      $initialEditorState: () =>
        $convertFromMarkdownString(
          initialValue,
          MARKDOWN,
          undefined,
          false,
          readOnly === true && !keepLineBreaks,
        ),
      onError: (error) => {
        throw error;
      },
    }),
  );

  return (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <div className="relative">
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

        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />

        {readOnly === true && (
          <ShownText value={initialValue} shortLines={!keepLineBreaks} />
        )}

        {onChange && (
          <OnChangePlugin
            ignoreSelectionChange
            onChange={(state) =>
              state.read(() => onChange($convertToMarkdownString(MARKDOWN)))
            }
          />
        )}
      </div>
    </LexicalExtensionComposer>
  );
}
