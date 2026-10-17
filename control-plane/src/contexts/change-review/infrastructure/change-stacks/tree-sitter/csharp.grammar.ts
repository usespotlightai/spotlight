import {
  field,
  firstEndingIn,
  type Grammar,
  type GrammarRoute,
  named,
  suffixes,
  unquoted,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import type { Node } from '@vscode/tree-sitter-wasm';

const STRINGS = new Set([
  'string_literal',
  'verbatim_string_literal',
  'raw_string_literal',
  'interpolated_string_expression',
]);

const HTTP_ATTRIBUTES: Readonly<Record<string, string>> = {
  HttpGet: 'GET',
  HttpPost: 'POST',
  HttpPut: 'PUT',
  HttpPatch: 'PATCH',
  HttpDelete: 'DELETE',
  HttpHead: 'HEAD',
  HttpOptions: 'OPTIONS',
};

const MAP_CALL = /^Map(Get|Post|Put|Patch|Delete)?$/;

const attributeName = (attribute: Node): string =>
  (field(attribute, 'name')?.text.split('.').pop() ?? '').replace(
    /Attribute$/,
    '',
  );

const attributesOf = (node: Node): Node[] =>
  named(node)
    .filter((child) => child.type === 'attribute_list')
    .flatMap((list) => named(list))
    .filter((child) => child.type === 'attribute');

const isRoute = (attribute: Node): boolean => {
  const name = attributeName(attribute);
  return name === 'Route' || name in HTTP_ATTRIBUTES;
};

const templateOf = (attribute: Node): string | null => {
  const first = named(
    named(attribute).find(
      (child) => child.type === 'attribute_argument_list',
    ) ?? null,
  )[0];
  const value = named(first ?? null)[0];

  return value && STRINGS.has(value.type) ? unquoted(value.text) : null;
};

const token = (name: string | undefined, suffix: string): string =>
  (name ?? '').replace(new RegExp(`${suffix}$`), '').toLowerCase();

const callRoute = (node: Node): GrammarRoute | null => {
  const verb = field(node, 'function')?.text.split('.').pop() ?? '';
  const [, method] = verb.match(MAP_CALL) ?? [];
  const path = named(field(node, 'arguments'))
    .map((argument) => named(argument)[0])
    .find((value) => STRINGS.has(value?.type ?? ''));
  const literal = path ? unquoted(path.text) : '';

  return MAP_CALL.test(verb) && path && (method || literal.startsWith('/'))
    ? { method: method?.toUpperCase() ?? 'ANY', path: literal }
    : null;
};

const methodRoute = (list: Node): GrammarRoute | null => {
  const method = list.parent;

  if (
    method?.type !== 'method_declaration' ||
    named(method).find(
      (child) => child.type === 'attribute_list' && named(child).some(isRoute),
    )?.id !== list.id
  ) {
    return null;
  }

  const attributes = attributesOf(method);
  const http = attributes.find(
    (attribute) => attributeName(attribute) in HTTP_ATTRIBUTES,
  );
  const route = attributes.find(
    (attribute) => attributeName(attribute) === 'Route',
  );
  const template =
    (http ? templateOf(http) : null) ?? (route ? templateOf(route) : null);

  const path = (template ?? '').replace(
    '[action]',
    token(field(method, 'name')?.text, 'Async'),
  );

  return {
    method: http ? (HTTP_ATTRIBUTES[attributeName(http)] ?? 'ANY') : 'ANY',
    path: path.replace(/^~/, ''),
    absolute: /^~?\//.test(path),
  };
};

export const CSHARP_GRAMMAR: Grammar = {
  name: 'csharp',
  wasm: 'tree-sitter-c-sharp.wasm',
  extensions: /\.cs$/,
  scope: 'language',
  definitions: {
    class_declaration: 'class',
    record_declaration: 'class',
    struct_declaration: 'type',
    interface_declaration: 'type',
    enum_declaration: 'type',
    delegate_declaration: 'type',
    method_declaration: 'method',
    field_declaration: 'constant',
  },
  namesOf: (node) => {
    if (node.type !== 'field_declaration') {
      const name = field(node, 'name');
      return name ? [name] : [];
    }

    return named(node).some(
      (child) => child.type === 'modifier' && child.text === 'const',
    )
      ? node.descendantsOfType('variable_declarator').flatMap((declarator) => {
          const name = declarator ? field(declarator, 'name') : null;
          return name ? [name] : [];
        })
      : [];
  },
  hosts: new Set(),
  bodies: new Set([
    'method_declaration',
    'constructor_declaration',
    'local_function_statement',
    'accessor_declaration',
    'lambda_expression',
    'anonymous_method_expression',
  ]),
  identifiers: new Set(['identifier']),
  members: {
    member_access_expression: ['expression', 'name'],
    qualified_name: ['qualifier', 'name'],
  },
  strings: STRINGS,
  calls: {},
  importsOf: (node) => {
    if (node.type !== 'using_directive') {
      return null;
    }

    const alias = field(node, 'name');
    const specifier =
      named(node).find((child) => child.id !== alias?.id)?.text ?? '';
    const imported = specifier.split('.').pop();

    return alias && imported
      ? [{ local: alias.text, imported, specifier }]
      : [];
  },
  resolve: (specifier, _from, paths) =>
    firstEndingIn(
      paths,
      suffixes(specifier.split('.'), 1).map((suffix) => `${suffix}.cs`),
    ),
  project: () => false,
  exportedAs: (_definition, name) => [name],
  prefixOf: (host) => {
    const route = attributesOf(host).find(
      (attribute) => attributeName(attribute) === 'Route',
    );
    const template = route ? templateOf(route) : null;

    return template === null
      ? null
      : template.replace(
          '[controller]',
          token(field(host, 'name')?.text, 'Controller'),
        );
  },
  routeOf: (node) =>
    node.type === 'attribute_list'
      ? methodRoute(node)
      : node.type === 'invocation_expression'
        ? callRoute(node)
        : null,
};
