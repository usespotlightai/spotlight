import {
  ANY_VERBS,
  dirname,
  field,
  firstEndingIn,
  type Grammar,
  type GrammarImport,
  type GrammarRoute,
  HTTP_VERBS,
  named,
  suffixes,
  unquoted,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import type { Node } from '@vscode/tree-sitter-wasm';

const STRINGS = new Set(['string', 'encapsed_string']);

const ATTRIBUTE_VERBS: Readonly<Record<string, string | null>> = {
  Route: null,
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
  Any: 'ANY',
};

const lastSegment = (name: string): string => name.split('\\').pop() ?? '';

const argumentValue = (argument: Node): Node | null =>
  named(argument)
    .filter((child) => child !== field(argument, 'name'))
    .pop() ?? null;

const firstText = (node: Node | null): string | null => {
  const found = STRINGS.has(node?.type ?? '')
    ? node
    : (node?.descendantsOfType([...STRINGS])[0] ?? null);

  return found ? unquoted(found.text) : null;
};

const attributeRoute = (attribute: Node): GrammarRoute | null => {
  const verb = ATTRIBUTE_VERBS[lastSegment(named(attribute)[0]?.text ?? '')];

  if (verb === undefined) {
    return null;
  }

  const parameters = named(field(attribute, 'parameters'));
  const labelled = (label: string) =>
    parameters.find((argument) => field(argument, 'name')?.text === label);
  const path =
    labelled('path') ??
    parameters.find(
      (argument) =>
        !field(argument, 'name') &&
        STRINGS.has(argumentValue(argument)?.type ?? ''),
    );
  const methods = labelled('methods');

  return {
    method:
      verb ??
      (methods ? firstText(argumentValue(methods))?.toUpperCase() : null) ??
      'ANY',
    path: path ? (firstText(argumentValue(path)) ?? '') : '',
  };
};

const ownerOf = (attribute: Node): Node | null => {
  let list = attribute.parent;
  while (list && list.type !== 'attribute_list') {
    list = list.parent;
  }
  return list?.parent ?? null;
};

const attributesOf = (node: Node): Node[] =>
  (field(node, 'attributes')?.descendantsOfType('attribute') ?? []).filter(
    (attribute): attribute is Node => attribute !== null,
  );

const callRoute = (node: Node): GrammarRoute | null => {
  const verb = field(node, 'name')?.text.toLowerCase() ?? '';

  if (!HTTP_VERBS.has(verb) && !ANY_VERBS.has(verb)) {
    return null;
  }

  const path = named(field(node, 'arguments'))
    .map(argumentValue)
    .find((value) => STRINGS.has(value?.type ?? ''));
  const literal = path ? unquoted(path.text) : '';
  const facade =
    node.type === 'scoped_call_expression' &&
    lastSegment(field(node, 'scope')?.text ?? '') === 'Route';

  return path && (facade || literal.startsWith('/'))
    ? {
        method: HTTP_VERBS.has(verb) ? verb.toUpperCase() : 'ANY',
        path: literal,
      }
    : null;
};

export const PHP_GRAMMAR: Grammar = {
  name: 'php',
  wasm: 'tree-sitter-php.wasm',
  extensions: /\.php$/,
  scope: 'directory',
  definitions: {
    function_definition: 'function',
    method_declaration: 'method',
    class_declaration: 'class',
    interface_declaration: 'type',
    trait_declaration: 'type',
    enum_declaration: 'type',
    const_element: 'constant',
  },
  namesOf: (node) => {
    const name =
      node.type === 'const_element'
        ? named(node).find((child) => child.type === 'name')
        : field(node, 'name');
    return name ? [name] : [];
  },
  hosts: new Set(),
  bodies: new Set([
    'function_definition',
    'method_declaration',
    'anonymous_function',
    'arrow_function',
  ]),
  identifiers: new Set(['name']),
  opaque: new Set(['variable_name', 'namespace_name']),
  members: {
    member_call_expression: ['object', 'name'],
    nullsafe_member_call_expression: ['object', 'name'],
    member_access_expression: ['object', 'name'],
    nullsafe_member_access_expression: ['object', 'name'],
    scoped_call_expression: ['scope', 'name'],
  },
  strings: STRINGS,
  interpolations: /\$\w+(?:->\w+)*/g,
  calls: {},
  importsOf: (node) => {
    if (node.type !== 'namespace_use_declaration') {
      return null;
    }

    const group = field(node, 'body')
      ? named(node).find((child) => child.type === 'namespace_name')?.text
      : undefined;

    return node
      .descendantsOfType('namespace_use_clause')
      .flatMap((clause): GrammarImport[] => {
        const target = clause ? named(clause)[0] : undefined;
        const specifier = (
          group ? `${group}\\${target?.text}` : (target?.text ?? '')
        ).replace(/^\\/, '');
        const imported = lastSegment(specifier);
        const local =
          (clause ? field(clause, 'alias')?.text : undefined) ?? imported;

        return target && imported ? [{ local, imported, specifier }] : [];
      });
  },
  resolve: (specifier, _from, paths) => {
    const parts = specifier.split('\\').filter(Boolean);

    const file = firstEndingIn(
      paths,
      suffixes(parts, 2).map((suffix) => `${suffix}.php`),
    );
    if (file.length > 0) {
      return file;
    }

    for (const suffix of suffixes(parts.slice(0, -1), 1)) {
      const found = paths.filter((path) => {
        const directory = dirname(path);
        return directory === suffix || directory.endsWith(`/${suffix}`);
      });
      if (found.length > 0) {
        return found;
      }
    }

    return [];
  },
  project: () => false,
  exportedAs: (_definition, name) => [name],
  prefixOf: (host) =>
    attributesOf(host)
      .map(attributeRoute)
      .find((route) => route !== null)?.path ?? null,
  routeOf: (node) => {
    if (
      node.type === 'attribute' &&
      ownerOf(node)?.type === 'method_declaration'
    ) {
      return attributeRoute(node);
    }

    return node.type === 'scoped_call_expression' ||
      node.type === 'member_call_expression'
      ? callRoute(node)
      : null;
  },
};
