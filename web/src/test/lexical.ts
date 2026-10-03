import { act } from '@testing-library/react';
import {
  $createParagraphNode,
  $getRoot,
  type EditorState,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from 'lexical';

const editorOf = (element: HTMLElement): LexicalEditor =>
  (element as unknown as { __lexicalEditor: LexicalEditor }).__lexicalEditor;

export const write = (element: HTMLElement, text: string) =>
  act(() => {
    editorOf(element).update(() => $getRoot().selectEnd().insertText(text), {
      discrete: true,
    });
  });

export const erase = (element: HTMLElement) =>
  act(() => {
    editorOf(element).update(
      () => {
        $getRoot().clear().append($createParagraphNode());
      },
      { discrete: true },
    );
  });

export const pressEnter = (element: HTMLElement, { shift = false } = {}) =>
  act(() => {
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

export const restore = (element: HTMLElement, state: EditorState) =>
  act(() => {
    editorOf(element).setEditorState(state.clone(null));
  });
