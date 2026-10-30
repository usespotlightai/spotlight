import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { LexicalEditor } from 'lexical';
import { type RefObject, useEffect } from 'react';

type EditorHandleProps = {
  editorRef: RefObject<LexicalEditor | null>;
  editable: boolean;
};

export function EditorHandle({ editorRef, editable }: EditorHandleProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
}
