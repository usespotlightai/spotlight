import type { LexicalEditor } from 'lexical';
import type { RefObject } from 'react';

import { useCommands } from '@/hooks/useCommands';

export function useReplyKey(
  editor: RefObject<LexicalEditor | null>,
  enabled: boolean,
) {
  useCommands(
    enabled ? [{ id: 'inbox.reply', run: () => editor.current?.focus() }] : [],
  );
}
