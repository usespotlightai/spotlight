import type { LexicalEditor } from 'lexical';
import type { RefObject } from 'react';

import { useEditorHandle } from '@/hooks/useEditorHandle';

type EditorHandleProps = {
  editorRef: RefObject<LexicalEditor | null>;
  editable: boolean;
};

export function EditorHandle({ editorRef, editable }: EditorHandleProps) {
  useEditorHandle(editorRef, editable);

  return null;
}
