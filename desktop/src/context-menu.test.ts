import type { ContextMenuParams, WebContents } from 'electron';
import { describe, expect, it } from 'vitest';
import { contextMenuOf } from './context-menu';

const params = (change: Partial<ContextMenuParams>): ContextMenuParams =>
  ({
    misspelledWord: '',
    dictionarySuggestions: [],
    linkURL: '',
    mediaType: 'none',
    isEditable: false,
    selectionText: '',
    x: 0,
    y: 0,
    editFlags: {
      canCut: true,
      canCopy: true,
      canPaste: true,
      canSelectAll: true,
    },
    ...change,
  }) as ContextMenuParams;

const labels = (change: Partial<ContextMenuParams>) =>
  contextMenuOf(params(change), {} as WebContents).map(
    (each) => each.label ?? each.role ?? each.type,
  );

describe('contextMenuOf', () => {
  it('offers spelling guesses before editing in a text field', () => {
    expect(
      labels({
        isEditable: true,
        misspelledWord: 'recieve',
        dictionarySuggestions: ['receive', 'relieve'],
      }),
    ).toEqual([
      'receive',
      'relieve',
      'Learn Spelling',
      'separator',
      'cut',
      'copy',
      'paste',
      'pasteAndMatchStyle',
      'separator',
      'selectAll',
    ]);
  });

  it('offers to open and copy a link', () => {
    expect(labels({ linkURL: 'https://github.com/acme/api/pull/1' })).toEqual([
      'Open Link in Browser',
      'Copy Link',
    ]);
  });

  it('offers Copy for selected text outside a field', () => {
    expect(labels({ selectionText: 'a step' })).toEqual(['copy']);
  });

  it('shows nothing where there is nothing to do', () => {
    expect(labels({})).toEqual([]);
    expect(labels({ linkURL: 'javascript:alert(1)' })).toEqual([]);
  });
});
