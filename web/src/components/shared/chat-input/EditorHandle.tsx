import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { LexicalEditor } from 'lexical';
import { type RefObject, useEffect } from 'react';

type EditorHandleProps = {
  handle: RefObject<LexicalEditor | null>;
  editable: boolean;
};

export function EditorHandle({ handle, editable }: EditorHandleProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    handle.current = editor;
    return () => {
      handle.current = null;
    };
  }, [editor, handle]);

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
}
