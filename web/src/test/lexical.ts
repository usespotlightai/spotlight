import { act } from '@testing-library/react';
import {
  $createParagraphNode,
  $getRoot,
  type EditorState,
  getEditorPropertyFromDOMNode,
  isLexicalEditor,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from 'lexical';

const editorOf = (element: HTMLElement): LexicalEditor => {
  const editor = getEditorPropertyFromDOMNode(element);
  if (!isLexicalEditor(editor)) {
    throw new Error('no Lexical editor on this element');
  }

  return editor;
};

export const write = (element: HTMLElement, text: string): Promise<void> =>
  act(async () => {
    editorOf(element).update(() => $getRoot().selectEnd().insertText(text), {
      discrete: true,
    });
  });

export const erase = (element: HTMLElement): Promise<void> =>
  act(async () => {
    editorOf(element).update(
      () => {
        $getRoot().clear().append($createParagraphNode());
      },
      { discrete: true },
    );
  });

export const pressEnter = (
  element: HTMLElement,
  { shift = false } = {},
): Promise<void> =>
  act(async () => {
    editorOf(element).dispatchCommand(
      KEY_ENTER_COMMAND,
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: shift }),
    );
  });

export const textOf = (element: HTMLElement): string =>
  editorOf(element)
    .getEditorState()
    .read(() => $getRoot().getTextContent());

export const snapshot = (element: HTMLElement): EditorState =>
  editorOf(element).getEditorState();

export const restore = (
  element: HTMLElement,
  state: EditorState,
): Promise<void> =>
  act(async () => {
    editorOf(element).setEditorState(state.clone(null));
  });
