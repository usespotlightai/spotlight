import {
  field,
  type Grammar,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';

export const RUBY_GRAMMAR: Grammar = {
  name: 'ruby',
  wasm: 'tree-sitter-ruby.wasm',
  extensions: /\.(rb|rake)$/,
  scope: 'language',
  definitions: {
    class: 'class',
    module: 'class',
    method: 'function',
    singleton_method: 'method',
    assignment: 'constant',
  },
  namesOf: (node) => {
    const name = field(node, node.type === 'assignment' ? 'left' : 'name');
    return name && (name.type === 'constant' || node.type !== 'assignment')
      ? [name]
      : [];
  },
  hosts: new Set(['class', 'module']),
  bodies: new Set([
    'method',
    'singleton_method',
    'block',
    'do_block',
    'lambda',
  ]),
  identifiers: new Set(['identifier', 'constant']),
  members: {
    call: ['receiver', 'method'],
    scope_resolution: ['scope', 'name'],
  },
  strings: new Set(['string']),
  calls: { call: ['method', 'arguments'] },
  importsOf: () => null,
  resolve: () => [],
  project: () => false,
  exportedAs: (_definition, name) => [name],
};
