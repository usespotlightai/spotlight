import {
  ANY_VERBS,
  dirname,
  field,
  fields,
  type Grammar,
  type GrammarImport,
  type GrammarRoute,
  HTTP_VERBS,
  named,
  unquoted,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import type { Node } from '@vscode/tree-sitter-wasm';

const STRINGS = new Set(['interpreted_string_literal', 'raw_string_literal']);

const METHOD_PATTERN = /^([A-Z]+)\s+[^/\s]*(\/\S*)$/;

const routeOf = (node: Node): GrammarRoute | null => {
  if (node.type !== 'call_expression') {
    return null;
  }

  const verb = field(node, 'function')?.text.split('.').pop() ?? '';
  const pattern = named(field(node, 'arguments')).find((child) =>
    STRINGS.has(child.type),
  );
  const [, method, path] = pattern
    ? (unquoted(pattern.text).match(METHOD_PATTERN) ?? [])
    : [];

  return ANY_VERBS.has(verb.toLowerCase()) &&
    method &&
    path &&
    HTTP_VERBS.has(method.toLowerCase())
    ? { method, path }
    : null;
};

export const GO_GRAMMAR: Grammar = {
  name: 'go',
  wasm: 'tree-sitter-go.wasm',
  extensions: /\.go$/,
  scope: 'directory',
  definitions: {
    function_declaration: 'function',
    method_declaration: 'method',
    type_spec: 'type',
    const_spec: 'constant',
    var_spec: 'constant',
  },
  namesOf: (node) => fields(node, 'name'),
  hosts: new Set(),
  bodies: new Set([
    'function_declaration',
    'method_declaration',
    'func_literal',
  ]),
  identifiers: new Set(['identifier', 'type_identifier']),
  members: {
    selector_expression: ['operand', 'field'],
    qualified_type: ['package', 'name'],
  },
  strings: STRINGS,
  calls: { call_expression: ['function', 'arguments'] },
  importsOf: (node) => {
    if (node.type !== 'import_declaration') {
      return null;
    }

    return node
      .descendantsOfType('import_spec')
      .flatMap((spec): GrammarImport[] => {
        const path = spec ? field(spec, 'path') : null;
        const specifier = path ? unquoted(path.text) : '';
        const local =
          (spec ? field(spec, 'name')?.text : undefined) ??
          specifier
            .split('/')
            .filter((part) => !/^v\d+$/.test(part))
            .pop();

        return specifier && local && local !== '_' && local !== '.'
          ? [{ local, imported: '*', specifier }]
          : [];
      });
  },
  resolve: (specifier, _from, paths) =>
    paths.filter((path) => {
      const directory = dirname(path);
      return (
        directory !== '' &&
        (specifier === directory || specifier.endsWith(`/${directory}`))
      );
    }),
  project: () => false,
  exportedAs: (_definition, name) => [name],
  routeOf,
};
