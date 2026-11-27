import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';

import { DRAFT_SENT } from '@/lib/chat-input';

export function useSharedWriting(onWrote: () => void): void {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerUpdateListener(({ tags, dirtyElements, dirtyLeaves }) => {
        if (
          !tags.has('collaboration') &&
          !tags.has(DRAFT_SENT) &&
          (dirtyElements.size > 0 || dirtyLeaves.size > 0)
        ) {
          onWrote();
        }
      }),
    [editor, onWrote],
  );
}
