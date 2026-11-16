import type { LexicalEditor } from 'lexical';
import type { RefObject } from 'react';

import { useCommands } from '@/hooks/useCommands';

const focusReply = (editor: LexicalEditor | null) => {
  editor?.getRootElement()?.focus();
  editor?.focus(undefined, { defaultSelection: 'rootEnd' });
};

export function useReplyKey(
  editor: RefObject<LexicalEditor | null>,
  enabled: boolean,
) {
  useCommands(
    enabled
      ? [{ id: 'inbox.reply', run: () => focusReply(editor.current) }]
      : [],
  );
}
