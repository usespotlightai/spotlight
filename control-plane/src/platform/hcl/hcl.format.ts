import {
  type HclAttribute,
  type HclBlock,
  HclExpression,
  type HclItem,
  HclLines,
  type HclValue,
  quoted,
  withoutInterpolation,
} from '@platform/hcl/hcl';

type Line =
  | { readonly indent: number; readonly text: string }
  | {
      readonly indent: number;
      readonly lead: string;
      readonly assigned: string;
    };

interface Rendered {
  readonly first: string;
  readonly rest: readonly Line[];
}

const BLANK: Line = { indent: 0, text: '' };

const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

const KEYWORDS = new Set(['for', 'in', 'if', 'true', 'false', 'null']);

const HEREDOC_MARKER = 'EOT';

// biome-ignore lint/suspicious/noControlCharactersInRegex: a heredoc cannot contain control characters
const UNPRINTABLE = /[\u0000-\u0008\u000b-\u001f\u007f]/;

const keyOf = (key: string): string =>
  BARE_KEY.test(key) && !KEYWORDS.has(key) ? key : quoted(key);

const isMultiLine = (text: string): boolean =>
  text.endsWith('\n') &&
  text.indexOf('\n') < text.length - 1 &&
  !UNPRINTABLE.test(text);

const markerFor = (text: string): string => {
  const lines = new Set(text.split('\n').map((each) => each.trim()));
  let marker = HEREDOC_MARKER;

  for (let suffix = 1; lines.has(marker); suffix += 1) {
    marker = `${HEREDOC_MARKER}${suffix}`;
  }

  return marker;
};

const heredoc = (text: string): string => {
  const marker = markerFor(text);

  return `<<${marker}\n${withoutInterpolation(text)}${marker}`;
};

const isList = (value: HclValue): value is readonly HclValue[] =>
  Array.isArray(value);

const isObject = (
  value: HclValue,
): value is { readonly [key: string]: HclValue } =>
  typeof value === 'object' &&
  value !== null &&
  !isList(value) &&
  !(value instanceof HclExpression) &&
  !(value instanceof HclLines);

const isEmpty = (value: HclValue): boolean =>
  (isList(value) && value.length === 0) ||
  (isObject(value) && Object.keys(value).length === 0);

const fitsOnOneLine = (value: HclValue): boolean =>
  !(isList(value) || isObject(value) || value instanceof HclLines) ||
  isEmpty(value);

const closedWithComma = (lines: readonly Line[]): readonly Line[] =>
  lines.map((line, at) =>
    at === lines.length - 1 && 'text' in line
      ? { ...line, text: `${line.text},` }
      : line,
  );

const spanned = (items: readonly HclValue[], indent: number): Rendered => ({
  first: '[',
  rest: [
    ...items.flatMap((each) => {
      const item = rendered(each, indent + 1, false);

      return item.rest.length === 0
        ? [{ indent: indent + 1, text: `${item.first},` }]
        : [
            { indent: indent + 1, text: item.first },
            ...closedWithComma(item.rest),
          ];
    }),
    { indent, text: ']' },
  ],
});

const rendered = (
  value: HclValue,
  indent: number,
  spans: boolean,
): Rendered => {
  if (value instanceof HclExpression) {
    return { first: value.sourceText, rest: [] };
  }

  if (typeof value === 'string') {
    return {
      first: spans && isMultiLine(value) ? heredoc(value) : quoted(value),
      rest: [],
    };
  }

  if (value instanceof HclLines) {
    return spanned(value.items, indent);
  }

  if (isList(value)) {
    if (value.every(fitsOnOneLine)) {
      return {
        first: `[${value.map((each) => rendered(each, indent, false).first).join(', ')}]`,
        rest: [],
      };
    }

    return spanned(value, indent);
  }

  if (isObject(value)) {
    const entries = Object.entries(value);

    return entries.length === 0
      ? { first: '{}', rest: [] }
      : {
          first: '{',
          rest: [
            ...entries.flatMap(([key, each]) =>
              assignment(keyOf(key), each, indent + 1),
            ),
            { indent, text: '}' },
          ],
        };
  }

  return { first: String(value), rest: [] };
};

const assignment = (
  lead: string,
  value: HclValue,
  indent: number,
): readonly Line[] => {
  const { first, rest } = rendered(value, indent, true);

  return rest.length === 0
    ? [{ indent, lead, assigned: first }]
    : [{ indent, text: `${lead} = ${first}` }, ...rest];
};

const bodyLines = (
  items: readonly HclItem[],
  indent: number,
): readonly Line[] =>
  items.flatMap((item, at) => {
    const previous = items[at - 1];
    const apart =
      previous !== undefined &&
      (item.kind === 'block' || previous.kind === 'block');
    const lines =
      item.kind === 'block'
        ? blockLines(item, indent)
        : assignment(item.name, item.value, indent);

    return apart ? [BLANK, ...lines] : lines;
  });

const blockLines = (block: HclBlock, indent: number): readonly Line[] => {
  const header = [block.type, ...block.labels.map(quoted)].join(' ');

  return block.body.length === 0
    ? [{ indent, text: `${header} {}` }]
    : [
        { indent, text: `${header} {` },
        ...bodyLines(block.body, indent + 1),
        { indent, text: '}' },
      ];
};

const aligned = (lines: readonly Line[]): string[] => {
  const output: string[] = [];
  let run: { indent: number; lead: string; assigned: string }[] = [];

  const flush = () => {
    const width = Math.max(...run.map((each) => each.lead.length));

    for (const each of run) {
      output.push(
        `${'  '.repeat(each.indent)}${each.lead.padEnd(width)} = ${each.assigned}`,
      );
    }

    run = [];
  };

  for (const line of lines) {
    if ('lead' in line) {
      run.push(line);
      continue;
    }

    flush();
    output.push(
      line.text === '' ? '' : `${'  '.repeat(line.indent)}${line.text}`,
    );
  }

  flush();

  return output;
};

export const formatHcl = (blocks: readonly HclBlock[]): string =>
  `${aligned(bodyLines(blocks, 0)).join('\n')}\n`;

export const formatHclValue = (
  value: HclValue,
  indent: number,
  spans = true,
): string => {
  const { first, rest } = rendered(value, indent, spans);

  return [first, ...aligned(rest)].join('\n');
};

export const formatHclAttributes = (
  attributes: readonly HclAttribute[],
): readonly string[] => aligned(bodyLines(attributes, 0));
