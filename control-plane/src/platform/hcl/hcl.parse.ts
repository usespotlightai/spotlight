import { join } from 'node:path';
import { Language, type Node, Parser } from '@vscode/tree-sitter-wasm';

interface HclSpan {
  readonly start: number;
  readonly end: number;
}

export type HclLiteral =
  | string
  | number
  | boolean
  | null
  | readonly HclLiteral[];

export interface HclReference {
  readonly kind: 'reference';
  readonly type: string;
  readonly name: string;
  readonly attribute: string;
  readonly suffix: string | null;
}

interface HclListItem {
  readonly written: string;
  readonly read: HclRead;
}

export type HclRead =
  | { readonly kind: 'literal'; readonly value: HclLiteral }
  | {
      readonly kind: 'file';
      readonly path: string;
      readonly fromModule: boolean;
    }
  | HclReference
  | { readonly kind: 'list'; readonly items: readonly HclListItem[] }
  | { readonly kind: 'computed' };

export interface ParsedAttribute {
  readonly name: string;
  readonly span: HclSpan;
  readonly value: HclSpan;
  readonly written: string;
  readonly read: HclRead;
  readonly items: readonly HclListItem[] | null;
  readonly entries: Readonly<Record<string, HclRead>> | null;
}

export interface ParsedBlock {
  readonly type: string;
  readonly labels: readonly (string | null)[];
  readonly span: HclSpan;
  readonly body: ParsedBody;
}

export interface ParsedBody {
  readonly attributes: readonly ParsedAttribute[];
  readonly blocks: readonly ParsedBlock[];
  readonly opensAt: number;
  readonly closesAt: number;
  readonly commented: boolean;
}

export class HclSyntaxError extends Error {
  constructor(readonly at: number) {
    super(`does not parse as HCL, near character ${at}`);
    this.name = 'HclSyntaxError';
  }
}

const RUNTIME = join(require.resolve('@vscode/tree-sitter-wasm'), '..');

const GRAMMAR = join(__dirname, 'grammar', 'tree-sitter-hcl.wasm');

let loading: Promise<Language> | null = null;

const language = (): Promise<Language> => {
  loading ??= (async () => {
    await Parser.init({ locateFile: (file: string) => join(RUNTIME, file) });

    return Language.load(GRAMMAR);
  })().catch((error: unknown) => {
    loading = null;
    throw error;
  });

  return loading;
};

const childrenOf = (node: Node): Node[] =>
  node.children.filter((each): each is Node => each !== null);

const namedOf = (node: Node): Node[] =>
  childrenOf(node).filter((each) => each.isNamed && each.type !== 'comment');

const childOf = (node: Node, type: string): Node | null =>
  childrenOf(node).find((each) => each.type === type) ?? null;

const ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  r: '\r',
  t: '\t',
  '"': '"',
  '\\': '\\',
};

const unescapedTemplate = (text: string): string =>
  text.replace(/\$\$\{/g, '${').replace(/%%\{/g, '%{');

const unescapedQuoted = (text: string): string =>
  unescapedTemplate(
    text.replace(
      /\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)/g,
      (written: string, sequence: string) =>
        sequence.length > 1
          ? String.fromCodePoint(Number.parseInt(sequence.slice(1), 16))
          : (ESCAPES[sequence] ?? written),
    ),
  );

const literalTemplate = (
  parts: readonly Node[],
  unescaped: (text: string) => string,
): string | null =>
  parts.every((each) => each.type === 'template_literal')
    ? parts.map((each) => unescaped(each.text)).join('')
    : null;

const quotedTemplate = (node: Node): string | null =>
  literalTemplate(
    namedOf(node).filter(
      (each) =>
        each.type !== 'quoted_template_start' &&
        each.type !== 'quoted_template_end',
    ),
    unescapedQuoted,
  );

const LEADING = /^[ \t]*/;

const flushed = (lines: readonly string[]): string[] => {
  const indents = lines
    .filter((each) => each.trim().length > 0)
    .map((each) => (LEADING.exec(each)?.[0] ?? '').length);
  const common = indents.length > 0 ? Math.min(...indents) : 0;

  return lines.map((each) => each.slice(Math.min(common, each.length)));
};

const heredoc = (node: Node, text: string): string | null => {
  const named = namedOf(node);
  const [start, opening] = named;
  const closing = named[named.length - 1];

  if (
    !start ||
    !opening ||
    !closing ||
    closing === opening ||
    named
      .slice(2, -1)
      .some(
        (each) =>
          each.type !== 'template_literal' &&
          each.type !== 'heredoc_identifier',
      )
  ) {
    return null;
  }

  const after = text.indexOf('\n', opening.endIndex);
  const closingLine = text.lastIndexOf('\n', closing.startIndex - 1);

  if (after < 0 || closingLine < after) {
    return '';
  }

  const lines = text.slice(after + 1, closingLine + 1).split('\n');
  const content = lines.slice(0, -1);
  const kept = start.text.startsWith('<<-') ? flushed(content) : content;

  return unescapedTemplate(kept.map((each) => `${each}\n`).join(''));
};

const literalOf = (node: Node, text: string): HclLiteral | undefined => {
  switch (node.type) {
    case 'expression':
    case 'literal_value':
    case 'collection_value':
    case 'template_expr': {
      const [only, ...rest] = namedOf(node);

      return only && rest.length === 0 ? literalOf(only, text) : undefined;
    }
    case 'string_lit':
    case 'quoted_template':
      return quotedTemplate(node) ?? undefined;
    case 'heredoc_template':
      return heredoc(node, text) ?? undefined;
    case 'numeric_lit': {
      const number = Number(node.text);

      return Number.isFinite(number) ? number : undefined;
    }
    case 'bool_lit':
      return node.text === 'true';
    case 'null_lit':
      return null;
    case 'tuple': {
      const items = namedOf(node)
        .filter((each) => each.type === 'expression')
        .map((each) => literalOf(each, text));

      return items.every((each) => each !== undefined)
        ? (items as HclLiteral[])
        : undefined;
    }
    default:
      return undefined;
  }
};

const inner = (node: Node): Node => {
  const named = namedOf(node);
  const [only] = named;

  return (node.type === 'expression' || node.type === 'template_expr') &&
    only &&
    named.length === 1
    ? inner(only)
    : node;
};

const isModulePath = (node: Node): boolean => {
  const named = namedOf(node);
  const [start, interpolation, rest, end] = named;

  if (
    named.length !== 4 ||
    start?.type !== 'quoted_template_start' ||
    interpolation?.type !== 'template_interpolation' ||
    rest?.type !== 'template_literal' ||
    end?.type !== 'quoted_template_end' ||
    !rest.text.startsWith('/')
  ) {
    return false;
  }

  const expression = childOf(interpolation, 'expression');

  return expression?.text.replace(/\s+/g, '') === 'path.module';
};

const fileOf = (node: Node): HclRead | null => {
  const called = inner(node);

  if (
    called.type !== 'function_call' ||
    childOf(called, 'identifier')?.text !== 'file'
  ) {
    return null;
  }

  const args = childOf(called, 'function_arguments');
  const given = args ? namedOf(args) : [];
  const [only] = given;

  if (!only || given.length !== 1 || args?.text.includes('...')) {
    return null;
  }

  const argument = inner(only);

  if (argument.type === 'literal_value' || argument.type === 'string_lit') {
    const path = literalOf(argument, '');

    return typeof path === 'string'
      ? { kind: 'file', path, fromModule: false }
      : null;
  }

  if (argument.type === 'quoted_template' && isModulePath(argument)) {
    const rest = namedOf(argument)[2] as Node;

    return {
      kind: 'file',
      path: unescapedQuoted(rest.text).slice(1),
      fromModule: true,
    };
  }

  return null;
};

const traversalOf = (
  node: Node,
): Omit<HclReference, 'kind' | 'suffix'> | null => {
  const named = namedOf(node);
  const [root, name, attribute] = named;
  const nameOf = (step: Node | undefined): string | null =>
    step?.type === 'get_attr'
      ? (childOf(step, 'identifier')?.text ?? null)
      : null;
  const type =
    root?.type === 'variable_expr'
      ? (childOf(root, 'identifier')?.text ?? null)
      : null;
  const resource = nameOf(name);
  const field = nameOf(attribute);

  return node.type === 'expression' &&
    named.length === 3 &&
    type &&
    resource &&
    field
    ? { type, name: resource, attribute: field }
    : null;
};

const referenceOf = (node: Node): HclReference | null => {
  const direct = traversalOf(node);

  if (direct) {
    return { kind: 'reference', ...direct, suffix: null };
  }

  const template = inner(node);

  if (template.type !== 'quoted_template') {
    return null;
  }

  const [start, interpolation, rest, end, ...more] = namedOf(template);
  const expression = interpolation
    ? childOf(interpolation, 'expression')
    : null;
  const traversed = expression ? traversalOf(expression) : null;

  return start?.type === 'quoted_template_start' &&
    interpolation?.type === 'template_interpolation' &&
    rest?.type === 'template_literal' &&
    end?.type === 'quoted_template_end' &&
    more.length === 0 &&
    traversed
    ? { kind: 'reference', ...traversed, suffix: unescapedQuoted(rest.text) }
    : null;
};

function itemsOf(node: Node, text: string): HclListItem[] | null {
  const tuple = inner(node);
  const list =
    tuple.type === 'collection_value' ? namedOf(tuple)[0] : undefined;

  return list?.type === 'tuple'
    ? namedOf(list)
        .filter((each) => each.type === 'expression')
        .map((each) => ({ written: each.text, read: readOf(each, text) }))
    : null;
}

function entriesOf(node: Node, text: string): Record<string, HclRead> | null {
  const object = inner(node);
  const held =
    object.type === 'collection_value' ? namedOf(object)[0] : undefined;

  if (held?.type !== 'object') {
    return null;
  }

  return Object.fromEntries(
    namedOf(held)
      .filter((each) => each.type === 'object_elem')
      .flatMap((each) => {
        const [key, value] = namedOf(each).filter(
          (part) => part.type === 'expression',
        );
        const named = key ? inner(key) : null;
        const label =
          named?.type === 'variable_expr'
            ? named.text
            : named
              ? literalOf(named, text)
              : undefined;

        return typeof label === 'string' && value
          ? [[label, readOf(value, text)]]
          : [];
      }),
  );
}

function readOf(node: Node, text: string): HclRead {
  const file = fileOf(node);

  if (file) {
    return file;
  }

  const value = literalOf(node, text);

  if (value !== undefined) {
    return { kind: 'literal', value };
  }

  const reference = referenceOf(node);

  if (reference) {
    return reference;
  }

  const items = itemsOf(node, text);

  return items?.every(
    (each) => each.read.kind === 'literal' || each.read.kind === 'reference',
  )
    ? { kind: 'list', items }
    : { kind: 'computed' };
}

const labelOf = (node: Node): string | null =>
  node.type === 'identifier'
    ? node.text
    : node.type === 'string_lit'
      ? quotedTemplate(node)
      : null;

const attributeOf = (node: Node, text: string): ParsedAttribute | null => {
  const name = childOf(node, 'identifier');
  const value = childOf(node, 'expression');

  return name && value
    ? {
        name: name.text,
        span: { start: node.startIndex, end: node.endIndex },
        value: { start: value.startIndex, end: value.endIndex },
        written: value.text,
        read: readOf(value, text),
        items: itemsOf(value, text),
        entries: entriesOf(value, text),
      }
    : null;
};

const bodyOf = (
  node: Node | null,
  opensAt: number,
  closesAt: number,
  text: string,
): ParsedBody => {
  const items = node ? namedOf(node) : [];

  return {
    opensAt,
    commented:
      node !== null && childrenOf(node).some((each) => each.type === 'comment'),
    attributes: items.flatMap((each) => {
      const read = each.type === 'attribute' ? attributeOf(each, text) : null;

      return read ? [read] : [];
    }),
    blocks: items.flatMap((each) =>
      each.type === 'block' ? [blockOf(each, text)] : [],
    ),
    closesAt,
  };
};

const blockOf = (node: Node, text: string): ParsedBlock => {
  const [type, ...rest] = namedOf(node);
  const labels = rest.filter(
    (each) => each.type === 'identifier' || each.type === 'string_lit',
  );
  const start = childOf(node, 'block_start');
  const end = childOf(node, 'block_end');

  return {
    type: type?.text ?? '',
    labels: labels.map(labelOf),
    span: { start: node.startIndex, end: node.endIndex },
    body: bodyOf(
      childOf(node, 'body'),
      start?.endIndex ?? node.startIndex,
      end?.startIndex ?? node.endIndex,
      text,
    ),
  };
};

const firstError = (node: Node): number => {
  if (node.isError || node.isMissing) {
    return node.startIndex;
  }

  const broken = childrenOf(node).find((each) => each.hasError);

  return broken ? firstError(broken) : node.startIndex;
};

export const parsedHcl = async (text: string): Promise<ParsedBody> => {
  const loaded = await language();
  const parser = new Parser();

  try {
    parser.setLanguage(loaded);
    const tree = parser.parse(text);

    if (!tree) {
      throw new HclSyntaxError(0);
    }

    try {
      if (tree.rootNode.hasError) {
        throw new HclSyntaxError(firstError(tree.rootNode));
      }

      return bodyOf(childOf(tree.rootNode, 'body'), 0, text.length, text);
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
};
