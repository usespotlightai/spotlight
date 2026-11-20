import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  type MultilineElementTransformer,
  TRANSFORMERS,
  type Transformer,
} from '@lexical/markdown';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';

const ROW = /^\s*\|(.*)\|\s*$/;

const DIVIDER_CELL = /^\s*:?-+:?\s*$/;

const cellsOf = (line: string | undefined): string[] | null => {
  const found = line === undefined ? null : ROW.exec(line);

  return found
    ? found[1]
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim().replaceAll('\\|', '|'))
    : null;
};

const escapePipes = (markdown: string): string =>
  markdown.split('|').join('\\|');

const isDivider = (cells: readonly string[]): boolean =>
  cells.every((cell) => DIVIDER_CELL.test(cell));

const $cellOf = (text: string, header: boolean): TableCellNode => {
  const cell = $createTableCellNode(
    header ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS,
  );
  $convertFromMarkdownString(text, TRANSFORMERS, cell);
  return cell;
};

const textOf = (cell: TableCellNode): string =>
  escapePipes(
    $convertToMarkdownString(TRANSFORMERS, cell).replace(/\n+/g, ' '),
  ).trim();

const TABLE: MultilineElementTransformer = {
  type: 'multiline-element',
  dependencies: [TableNode, TableRowNode, TableCellNode],
  regExpStart: ROW,
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const header = cellsOf(lines[startLineIndex]);
    const divider = cellsOf(lines[startLineIndex + 1]);

    if (
      !header ||
      !divider ||
      divider.length !== header.length ||
      !isDivider(divider)
    ) {
      return null;
    }

    const table = $createTableNode();
    const addRow = (cells: readonly string[], isHeader: boolean) => {
      const row = $createTableRowNode();
      for (let at = 0; at < header.length; at++) {
        row.append($cellOf(cells[at] ?? '', isHeader));
      }
      table.append(row);
    };

    addRow(header, true);
    let last = startLineIndex + 1;
    for (let cells = cellsOf(lines[last + 1]); cells;) {
      addRow(cells, false);
      last += 1;
      cells = cellsOf(lines[last + 1]);
    }

    rootNode.append(table);
    return [true, last];
  },
  replace: () => false,
  export: (node) => {
    if (!$isTableNode(node)) {
      return null;
    }

    const lines: string[] = [];
    for (const row of node.getChildren()) {
      if (!$isTableRowNode(row)) {
        continue;
      }
      const cells = row.getChildren().filter($isTableCellNode);
      lines.push(`| ${cells.map(textOf).join(' | ')} |`);
      if (lines.length === 1) {
        lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
      }
    }

    return lines.join('\n');
  },
};

export const MARKDOWN: Transformer[] = [TABLE, ...TRANSFORMERS];
