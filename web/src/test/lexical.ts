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
  act(() => {
    editorOf(element).update(() => $getRoot().selectEnd().insertText(text), {
      discrete: true,
    });

    return Promise.resolve();
  });

export const erase = (element: HTMLElement): Promise<void> =>
  act(() => {
    editorOf(element).update(
      () => {
        $getRoot().clear().append($createParagraphNode());
      },
      { discrete: true },
    );

    return Promise.resolve();
  });

export const pressEnter = (
  element: HTMLElement,
  { shift = false } = {},
): Promise<void> =>
  act(() => {
    editorOf(element).dispatchCommand(
      KEY_ENTER_COMMAND,
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: shift }),
    );

    return Promise.resolve();
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
  act(() => {
    editorOf(element).setEditorState(state.clone(null));

    return Promise.resolve();
  });
