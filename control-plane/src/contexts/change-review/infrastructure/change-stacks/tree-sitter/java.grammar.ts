import {
  endingIn,
  field,
  type Grammar,
  type GrammarRoute,
  unquoted,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import type { Node } from '@vscode/tree-sitter-wasm';

const MAPPINGS: Readonly<Record<string, string>> = {
  GetMapping: 'GET',
  PostMapping: 'POST',
  PutMapping: 'PUT',
  PatchMapping: 'PATCH',
  DeleteMapping: 'DELETE',
  RequestMapping: 'ANY',
};

const mapping = (annotation: Node): GrammarRoute | null => {
  const method = MAPPINGS[field(annotation, 'name')?.text ?? ''];

  if (!method) {
    return null;
  }

  const value = field(annotation, 'arguments')?.descendantsOfType(
    'string_literal',
  )[0];

  return { method, path: value ? unquoted(value.text) : '' };
};

const annotationsOf = (node: Node): Node[] =>
  (
    node.namedChildren.find((child) => child?.type === 'modifiers')
      ?.namedChildren ?? []
  ).filter(
    (child): child is Node =>
      child?.type === 'annotation' || child?.type === 'marker_annotation',
  );

export const JAVA_GRAMMAR: Grammar = {
  name: 'java',
  wasm: 'tree-sitter-java.wasm',
  extensions: /\.java$/,
  scope: 'directory',
  definitions: {
    class_declaration: 'class',
    record_declaration: 'class',
    interface_declaration: 'type',
    enum_declaration: 'type',
    method_declaration: 'method',
  },
  hosts: new Set(['class_body', 'interface_body', 'enum_body']),
  bodies: new Set([
    'method_declaration',
    'constructor_declaration',
    'lambda_expression',
  ]),
  identifiers: new Set(['identifier', 'type_identifier']),
  members: {
    method_invocation: ['object', 'name'],
    field_access: ['object', 'field'],
  },
  strings: new Set(['string_literal']),
  calls: {},
  importsOf: (node) => {
    if (node.type !== 'import_declaration') {
      return null;
    }
    if (node.namedChildren.some((child) => child?.type === 'asterisk')) {
      return [];
    }

    const specifier =
      node.namedChildren.find((child) => child?.type === 'scoped_identifier')
        ?.text ?? '';
    const local = specifier.split('.').pop();

    return local ? [{ local, imported: local, specifier }] : [];
  },
  resolve: (specifier, _from, paths) => {
    const parts = specifier.split('.');
    const found = endingIn(paths, [`${parts.join('/')}.java`]);

    return found.length > 0
      ? found
      : endingIn(paths, [`${parts.slice(0, -1).join('/')}.java`]);
  },
  project: () => false,
  exportedAs: (_definition, name) => [name],
  prefixOf: (host) =>
    annotationsOf(host)
      .map(mapping)
      .find((route) => route !== null)?.path ?? null,
  routeOf: (node) =>
    node.type === 'annotation' &&
    node.parent?.parent?.type === 'method_declaration'
      ? mapping(node)
      : null,
};
