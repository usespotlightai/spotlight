import type { IndexedReference } from '@change-review/domain/services/symbol-index';
import {
  type EmbeddedScript,
  endingIn,
  field,
  type Grammar,
  type GrammarImport,
  type GrammarRoute,
  joined,
  dirname as parentOf,
  unquoted,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import type { Node } from '@vscode/tree-sitter-wasm';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs'];

const NEST_VERBS = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'All',
  'Head',
  'Options',
]);

const SCRIPT = /(<script\b[^>]*>)([\s\S]*?)<\/script>/g;

const blanked = (text: string): string => text.replace(/[^\n]/g, ' ');

const COMPONENT_TAG = /<([A-Z]\w*|[a-z]\w*(?:-\w+)+)/g;

const pascalCase = (tag: string): string =>
  tag
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const lineCounter = (text: string): ((at: number) => number) => {
  let line = 1;
  let counted = 0;

  return (at) => {
    for (; counted < at; counted += 1) {
      if (text[counted] === '\n') {
        line += 1;
      }
    }
    return line;
  };
};

const embeddedScript = (text: string): EmbeddedScript => {
  const lineAt = lineCounter(text);
  const references: IndexedReference[] = [];
  const tagsBetween = (from: number, to: number) => {
    for (const tag of text.slice(from, to).matchAll(COMPONENT_TAG)) {
      references.push({
        name: pascalCase(tag[1] ?? ''),
        line: lineAt(from + tag.index),
        through: null,
      });
    }
  };
  let script = '';
  let at = 0;

  for (const match of text.matchAll(SCRIPT)) {
    const start = match.index + (match[1]?.length ?? 0);
    const body = match[2] ?? '';

    tagsBetween(at, match.index);
    script += blanked(text.slice(at, start)) + body;
    at = start + body.length;
  }
  tagsBetween(at, text.length);

  return { script: script + blanked(text.slice(at)), references };
};

const stringIn = (node: Node | null): string | null => {
  const argument = node?.namedChildren.find(
    (child) => child?.type === 'string' || child?.type === 'object',
  );

  if (argument?.type === 'string') {
    return unquoted(argument.text);
  }

  const path = argument?.namedChildren.find(
    (pair) =>
      pair?.type === 'pair' &&
      field(pair, 'key')?.text.replace(/['"]/g, '') === 'path',
  );
  const value = path ? field(path, 'value') : null;

  return value?.type === 'string' ? unquoted(value.text) : null;
};

const decoratorCall = (
  decorator: Node,
): { name: string; argument: string | null } | null => {
  const call = decorator.namedChildren.find(
    (child) => child?.type === 'call_expression',
  );
  const callee = call ? field(call, 'function') : null;

  return call && callee?.type === 'identifier'
    ? { name: callee.text, argument: stringIn(field(call, 'arguments')) }
    : null;
};

const decoratorsOf = (host: Node): Node[] =>
  [
    ...host.children,
    ...(host.parent?.type === 'export_statement' ? host.parent.children : []),
  ].filter((child): child is Node => child?.type === 'decorator');

const importsOf = (node: Node): GrammarImport[] | null => {
  if (node.type === 'export_statement') {
    const source = field(node, 'source');

    if (!source) {
      return null;
    }

    const specifier = unquoted(source.text);
    const clause = node.namedChildren.find(
      (child) => child?.type === 'export_clause',
    );
    const named = (clause?.namedChildren ?? []).flatMap((each) => {
      const name = each ? field(each, 'name')?.text : undefined;
      return name ? [{ local: '', imported: name, specifier }] : [];
    });

    return named.length > 0 ? named : [{ local: '', imported: '*', specifier }];
  }
  if (node.type !== 'import_statement') {
    return null;
  }

  const source = field(node, 'source');
  const specifier = source ? unquoted(source.text) : '';
  const clause = node.namedChildren.find(
    (child) => child?.type === 'import_clause',
  );

  return (clause?.namedChildren ?? []).flatMap((part): GrammarImport[] => {
    if (!part) {
      return [];
    }
    if (part.type === 'identifier') {
      return [{ local: part.text, imported: 'default', specifier }];
    }
    if (part.type === 'namespace_import') {
      const local = part.namedChildren[0]?.text;
      return local ? [{ local, imported: '*', specifier }] : [];
    }

    return part.namedChildren.flatMap((each): GrammarImport[] => {
      const name = each ? field(each, 'name')?.text : undefined;
      const alias = each ? field(each, 'alias')?.text : undefined;

      return name ? [{ local: alias ?? name, imported: name, specifier }] : [];
    });
  });
};

const candidates = (base: string): string[] => [
  base,
  ...EXTENSIONS.map((extension) => `${base}${extension}`),
  ...EXTENSIONS.map((extension) => `${base}/index${extension}`),
];

const resolve = (
  specifier: string,
  from: string,
  paths: readonly string[],
): string[] => {
  const bare = specifier.replace(/\.[cm]?jsx?$/, '');

  if (bare.startsWith('.')) {
    const wanted = new Set(candidates(joined(parentOf(from), bare)));
    return paths.filter((path) => wanted.has(path));
  }

  const [scope, ...rest] = bare.split('/');
  const aliased =
    scope === '@' || scope === '~' || scope?.startsWith('#')
      ? rest
      : scope?.startsWith('@') &&
          rest.length >= 2 &&
          paths.some((path) => path.split('/').includes(scope.slice(1)))
        ? [scope.slice(1), ...rest]
        : [];

  if (aliased.length === 0) {
    return [];
  }

  const found = endingIn(paths, candidates(aliased.join('/')));

  return found.length > 0 || scope === '@' || scope === '~'
    ? found
    : endingIn(paths, candidates(rest.join('/')));
};

const exportedAs = (definition: Node, name: string): string[] => {
  const statement =
    definition.type === 'variable_declarator'
      ? definition.parent?.parent
      : definition.parent;

  if (statement?.type !== 'export_statement') {
    return [];
  }

  return statement.children.some((child) => child?.type === 'default')
    ? ['default', name]
    : [name];
};

const aliases = (node: Node): [string, string][] => {
  if (node.type !== 'export_statement' || field(node, 'source')) {
    return [];
  }

  const value = field(node, 'value');

  if (value?.type === 'identifier') {
    return [[value.text, 'default']];
  }

  const clause = node.namedChildren.find(
    (child) => child?.type === 'export_clause',
  );

  return (clause?.namedChildren ?? []).flatMap((each): [string, string][] => {
    const name = each ? field(each, 'name')?.text : undefined;
    const alias = each ? field(each, 'alias')?.text : undefined;

    return name ? [[name, alias ?? name]] : [];
  });
};

const prefixOf = (host: Node): string | null => {
  for (const decorator of decoratorsOf(host)) {
    const call = decoratorCall(decorator);

    if (call?.name === 'Controller') {
      return call.argument ?? '';
    }
  }

  return null;
};

const routeOf = (node: Node): GrammarRoute | null => {
  if (node.type !== 'decorator') {
    return null;
  }

  const call = decoratorCall(node);

  return call && NEST_VERBS.has(call.name)
    ? { method: call.name.toUpperCase(), path: call.argument ?? '' }
    : null;
};

const javascript = (
  name: string,
  wasm: string,
  extensions: RegExp,
  { components, embedded = false }: { components: boolean; embedded?: boolean },
): Grammar => ({
  name,
  wasm,
  extensions,
  scope: 'file',
  definitions: {
    function_declaration: 'function',
    generator_function_declaration: 'function',
    class_declaration: 'class',
    abstract_class_declaration: 'class',
    interface_declaration: 'type',
    type_alias_declaration: 'type',
    enum_declaration: 'type',
    method_definition: 'method',
    abstract_method_signature: 'method',
    variable_declarator: 'constant',
  },
  namesOf: (node) => {
    const named = field(node, 'name');
    return named && /identifier$/.test(named.type) ? [named] : [];
  },
  hosts: new Set(['class_body']),
  bodies: new Set([
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
  ]),
  identifiers: new Set([
    'identifier',
    'type_identifier',
    'shorthand_property_identifier',
  ]),
  members: {
    member_expression: ['object', 'property'],
    nested_type_identifier: ['module', 'name'],
  },
  strings: new Set(['string', 'template_string']),
  calls: { call_expression: ['function', 'arguments'] },
  importsOf,
  resolve,
  project: (specifier) => /^(\.|@\/|~\/|#)/.test(specifier),
  exportedAs,
  aliases,
  prefixOf,
  routeOf,
  components,
  ...(embedded ? { embedded: embeddedScript } : {}),
});

export const TYPESCRIPT_GRAMMARS: readonly Grammar[] = [
  javascript('typescript', 'tree-sitter-typescript.wasm', /\.[cm]?ts$/, {
    components: false,
  }),
  javascript('tsx', 'tree-sitter-tsx.wasm', /\.tsx$/, { components: true }),
  javascript('javascript', 'tree-sitter-javascript.wasm', /\.([cm]?js|jsx)$/, {
    components: true,
  }),
  javascript('vue', 'tree-sitter-typescript.wasm', /\.vue$/, {
    components: true,
    embedded: true,
  }),
  javascript('svelte', 'tree-sitter-typescript.wasm', /\.svelte$/, {
    components: true,
    embedded: true,
  }),
];
