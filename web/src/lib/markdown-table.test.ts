import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import {
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $getRoot, $isTextNode, createEditor, type LexicalNode } from 'lexical';
import { describe, expect, it } from 'vitest';

import { MARKDOWN } from '@/lib/markdown-table';

const read = <T>(markdown: string, look: () => T): T => {
  const editor = createEditor({
    nodes: [TableNode, TableRowNode, TableCellNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => $convertFromMarkdownString(markdown, MARKDOWN), {
    discrete: true,
  });
  return editor.getEditorState().read(look);
};

const rowsOf = (table: LexicalNode | undefined): string[][] =>
  $isTableNode(table)
    ? table
        .getChildren()
        .filter($isTableRowNode)
        .map((row) =>
          row
            .getChildren()
            .filter($isTableCellNode)
            .map((cell) => cell.getTextContent()),
        )
    : [];

describe('markdown tables', () => {
  it('reads a table that follows a line of text', () => {
    const markdown = [
      'Other formats that deserve their own icon:',
      '| Format | Lucide icon | Extensions |',
      '|---|---|---|',
      '| Video | `Video` (or `FileVideo`) | mov, mp4 |',
      '| Logs | `ScrollText` | log |',
      'I would keep code on Braces.',
    ].join('\n');

    const shape = read(markdown, () =>
      $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    );
    const rows = read(markdown, () => rowsOf($getRoot().getChildren()[1]));

    expect(shape).toEqual(['paragraph', 'table', 'paragraph']);
    expect(rows).toEqual([
      ['Format', 'Lucide icon', 'Extensions'],
      ['Video', 'Video (or FileVideo)', 'mov, mp4'],
      ['Logs', 'ScrollText', 'log'],
    ]);
  });

  it('marks the first row as the header', () => {
    const headers = read('| A | B |\n|---|:-:|\n| 1 | 2 |', () => {
      const table = $getRoot().getFirstChild();
      return $isTableNode(table)
        ? table
            .getChildren()
            .filter($isTableRowNode)
            .map((row) =>
              row
                .getChildren()
                .filter($isTableCellNode)
                .every(
                  (cell) =>
                    cell.getHeaderStyles() === TableCellHeaderStates.ROW,
                ),
            )
        : [];
    });

    expect(headers).toEqual([true, false]);
  });

  it('keeps the inline code inside a cell', () => {
    const coded = read('| Icon |\n|---|\n| `Video` |', () => {
      const table = $getRoot().getFirstChild();
      const text = $isTableNode(table)
        ? table
            .getAllTextNodes()
            .find((node) => node.getTextContent() === 'Video')
        : undefined;
      return $isTextNode(text) && text.hasFormat('code');
    });

    expect(coded).toBe(true);
  });

  it('leaves a line between pipes as text when no divider follows', () => {
    const shape = read('| not a table |\nnext line', () =>
      $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    );

    expect(shape).not.toContain('table');
  });

  it('fills short rows and drops cells past the header', () => {
    const rows = read('| A | B |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |', () =>
      rowsOf($getRoot().getFirstChild() ?? undefined),
    );

    expect(rows).toEqual([
      ['A', 'B'],
      ['1', ''],
      ['1', '2'],
    ]);
  });

  it('writes a table back as markdown', () => {
    const editor = createEditor({
      nodes: [TableNode, TableRowNode, TableCellNode],
      onError: (error) => {
        throw error;
      },
    });
    editor.update(
      () =>
        $convertFromMarkdownString(
          '| A | B |\n|---|---|\n| `x` | a \\| b |',
          MARKDOWN,
        ),
      { discrete: true },
    );

    const markdown = editor
      .getEditorState()
      .read(() => $convertToMarkdownString(MARKDOWN));

    expect(markdown).toBe('| A | B |\n| --- | --- |\n| `x` | a \\| b |');
  });
});
