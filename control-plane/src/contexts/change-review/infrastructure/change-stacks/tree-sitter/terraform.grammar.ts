import type { IndexedReference } from '@change-review/domain/services/symbol-index';
import {
  dirname,
  type Grammar,
  joined,
  named,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import { HCL_GRAMMAR_WASM } from '@platform/hcl/hcl.parse';
import type { Node } from '@vscode/tree-sitter-wasm';

const LABELLED: Readonly<Record<string, number>> = {
  resource: 2,
  data: 2,
  module: 1,
  variable: 1,
  output: 1,
};

const UNADDRESSED = new Set(['each', 'count', 'path', 'self', 'terraform']);

const META_ARGUMENTS = new Set([
  'source',
  'version',
  'count',
  'for_each',
  'providers',
  'depends_on',
]);

const INTERFACE = new Set(['variable', 'output']);

const literalText = (literal: Node): string =>
  named(literal)
    .filter((part) => part.type === 'template_literal')
    .map((part) => part.text)
    .join('');

const labelsOf = (block: Node): string[] =>
  named(block)
    .filter((child) => child.type === 'string_lit')
    .map(literalText);

const moduleSource = (module: Node): string | undefined => {
  const body = named(module).find((child) => child.type === 'body');
  const source = named(body ?? null).find(
    (attribute) =>
      attribute.type === 'attribute' && named(attribute)[0]?.text === 'source',
  );
  const literal = source?.descendantsOfType('string_lit')[0];

  return literal ? literalText(literal) : undefined;
};

const blockType = (block: Node): string =>
  named(block).find((child) => child.type === 'identifier')?.text ?? '';

const isLocal = (attribute: Node): boolean => {
  const block = attribute.parent?.parent;
  return block?.type === 'block' && blockType(block) === 'locals';
};

const addressOf = (block: Node): string => {
  const type = blockType(block);
  const labels = labelsOf(block);

  return type === 'resource'
    ? labels.join('.')
    : type === 'variable'
      ? `var.${labels[0]}`
      : [type, ...labels].join('.');
};

const traversal = (expression: Node): string[] => {
  const [root, ...steps] = named(expression);

  if (root?.type !== 'variable_expr') {
    return [];
  }

  const names = [root.text];
  for (const step of steps) {
    if (step.type !== 'get_attr') {
      break;
    }
    names.push(named(step)[0]?.text ?? '');
  }

  return names;
};

const moduleInput = (attribute: Node): IndexedReference[] => {
  const block = attribute.parent?.parent;
  const name = named(attribute)[0]?.text ?? '';
  const [module] = block?.type === 'block' ? labelsOf(block) : [];

  return block &&
    blockType(block) === 'module' &&
    module &&
    !META_ARGUMENTS.has(name)
    ? [
        {
          name,
          line: attribute.startPosition.row + 1,
          through: `module.${module}`,
        },
      ]
    : [];
};

const referencesOf = (node: Node): IndexedReference[] | null => {
  if (node.type === 'attribute') {
    return moduleInput(node);
  }
  if (node.type !== 'expression') {
    return null;
  }

  const [root = '', first, second] = traversal(node);
  const line = node.startPosition.row + 1;

  if (!first || UNADDRESSED.has(root)) {
    return [];
  }
  if (root === 'module') {
    return second ? [{ name: second, line, through: `module.${first}` }] : [];
  }
  if (root === 'data') {
    return second
      ? [{ name: `data.${first}.${second}`, line, through: null }]
      : [];
  }

  return [{ name: `${root}.${first}`, line, through: null }];
};

export const TERRAFORM_GRAMMAR: Grammar = {
  name: 'terraform',
  wasm: HCL_GRAMMAR_WASM,
  extensions: /\.tf$/,
  scope: 'directory',
  definitions: { block: 'constant', attribute: 'constant' },
  namesOf: (node) => {
    if (node.type === 'attribute') {
      const name = isLocal(node) ? named(node)[0] : undefined;
      return name ? [name] : [];
    }

    const labels = named(node).filter((child) => child.type === 'string_lit');
    const name = labels[(LABELLED[blockType(node)] ?? 0) - 1];

    return name && labels.length === LABELLED[blockType(node)] ? [name] : [];
  },
  nameOf: (definition, name) =>
    definition.type === 'attribute'
      ? `local.${name.text}`
      : addressOf(definition),
  referencesOf,
  hosts: new Set(),
  bodies: new Set(),
  identifiers: new Set(),
  members: {},
  strings: new Set(),
  calls: {},
  importsOf: (node) => {
    if (node.type !== 'block' || blockType(node) !== 'module') {
      return null;
    }

    const specifier = moduleSource(node);
    const [name] = labelsOf(node);

    return specifier && name
      ? [{ local: `module.${name}`, imported: '*', specifier }]
      : [];
  },
  resolve: (specifier, from, paths) => {
    if (!specifier.startsWith('.')) {
      return [];
    }

    const directory = joined(dirname(from), specifier);
    return paths.filter((path) => dirname(path) === directory);
  },
  project: (specifier) => specifier.startsWith('.'),
  exportedAs: (definition) =>
    definition.type === 'block' && INTERFACE.has(blockType(definition))
      ? labelsOf(definition).slice(0, 1)
      : [],
};
