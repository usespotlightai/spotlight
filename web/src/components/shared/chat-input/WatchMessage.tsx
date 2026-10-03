import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { useEffect } from 'react';
import { $isReferenceNode } from '@/components/shared/chat-input/ReferenceNode';
import type { Reference, Written } from '@/lib/chat-input';

const referencesIn = (node: LexicalNode): Reference[] => {
  if ($isReferenceNode(node)) {
    return [node.getReference()];
  }
  return $isElementNode(node) ? node.getChildren().flatMap(referencesIn) : [];
};

export function WatchMessage({
  onChange,
}: {
  onChange: (written: Written) => void;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) =>
        editorState.read(() =>
          onChange({
            text: $getRoot().getTextContent(),
            references: referencesIn($getRoot()),
          }),
        ),
      ),
    [editor, onChange],
  );

  return null;
}
