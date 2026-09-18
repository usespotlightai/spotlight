import {
  endingIn,
  field,
  type Grammar,
  type GrammarImport,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import type { Node } from '@vscode/tree-sitter-wasm';

const flattened = (node: Node | null, prefix: string): GrammarImport[] => {
  if (!node) {
    return [];
  }

  const joined = (path: string) => (prefix ? `${prefix}::${path}` : path);

  switch (node.type) {
    case 'identifier':
      return [{ local: node.text, imported: node.text, specifier: prefix }];
    case 'scoped_identifier': {
      const name = field(node, 'name')?.text;
      const path = field(node, 'path')?.text ?? '';
      return name
        ? [{ local: name, imported: name, specifier: joined(path) }]
        : [];
    }
    case 'use_as_clause': {
      const [inner] = flattened(field(node, 'path'), prefix);
      const alias = field(node, 'alias')?.text;
      return inner && alias ? [{ ...inner, local: alias }] : [];
    }
    case 'scoped_use_list':
      return flattened(
        field(node, 'list'),
        joined(field(node, 'path')?.text ?? ''),
      );
    case 'use_list':
      return node.namedChildren.flatMap((child) => flattened(child, prefix));
    default:
      return [];
  }
};

export const RUST_GRAMMAR: Grammar = {
  name: 'rust',
  wasm: 'tree-sitter-rust.wasm',
  extensions: /\.rs$/,
  scope: 'file',
  definitions: {
    function_item: 'function',
    function_signature_item: 'method',
    struct_item: 'type',
    enum_item: 'type',
    union_item: 'type',
    trait_item: 'type',
    type_item: 'type',
    const_item: 'constant',
    static_item: 'constant',
  },
  hosts: new Set(['impl_item', 'trait_item']),
  bodies: new Set(['function_item', 'closure_expression']),
  identifiers: new Set(['identifier', 'type_identifier']),
  members: {
    scoped_identifier: ['path', 'name'],
    scoped_type_identifier: ['path', 'name'],
    field_expression: ['value', 'field'],
  },
  strings: new Set(['string_literal', 'raw_string_literal']),
  calls: { call_expression: ['function', 'arguments'] },
  importsOf: (node) =>
    node.type === 'use_declaration'
      ? flattened(field(node, 'argument'), '')
      : null,
  resolve: (specifier, _from, paths) => {
    const parts = specifier
      .split('::')
      .filter((part) => !['crate', 'self', 'super'].includes(part));

    for (let length = parts.length; length > 0; length -= 1) {
      const base = parts.slice(0, length).join('/');
      const found = endingIn(paths, [`${base}.rs`, `${base}/mod.rs`]);

      if (found.length > 0) {
        return found;
      }
    }

    return [];
  },
  project: (specifier) => /^(crate|self|super)(::|$)/.test(specifier),
  exportedAs: (_definition, name) => [name],
};
