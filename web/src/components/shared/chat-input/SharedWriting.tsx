import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';

export const DRAFT_SENT = 'draft-sent';

export function SharedWriting({ onWrote }: { onWrote: () => void }) {
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

  return null;
}
