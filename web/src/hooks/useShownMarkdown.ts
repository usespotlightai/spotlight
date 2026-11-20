import { $convertFromMarkdownString } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';

import { MARKDOWN } from '@/lib/markdown-table';

export function useShownMarkdown(value: string, shortLines: boolean) {
  const [editor] = useLexicalComposerContext();
  const shown = useRef(value);

  useEffect(() => {
    if (shown.current === value) {
      return;
    }
    shown.current = value;
    editor.update(
      () =>
        $convertFromMarkdownString(
          value,
          MARKDOWN,
          undefined,
          false,
          shortLines,
        ),
      { tag: 'history-merge' },
    );
  }, [editor, value, shortLines]);
}
