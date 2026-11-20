import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { LexicalEditor } from 'lexical';
import { type RefObject, useEffect } from 'react';

export function useEditorHandle(
  editorRef: RefObject<LexicalEditor | null>,
  editable: boolean,
) {
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
}
