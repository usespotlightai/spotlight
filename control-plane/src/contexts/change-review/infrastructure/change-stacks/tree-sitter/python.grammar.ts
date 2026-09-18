import {
  dirname,
  endingIn,
  field,
  fields,
  type Grammar,
  type GrammarImport,
  joined,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';

const moduleFiles = (base: string): string[] => [
  `${base}.py`,
  `${base}/__init__.py`,
];

export const PYTHON_GRAMMAR: Grammar = {
  name: 'python',
  wasm: 'tree-sitter-python.wasm',
  extensions: /\.py$/,
  scope: 'file',
  definitions: {
    function_definition: 'function',
    class_definition: 'class',
    assignment: 'constant',
  },
  namesOf: (node) => {
    const name = field(node, node.type === 'assignment' ? 'left' : 'name');
    return name?.type === 'identifier' ? [name] : [];
  },
  hosts: new Set(['class_definition']),
  bodies: new Set(['function_definition', 'lambda']),
  identifiers: new Set(['identifier']),
  members: { attribute: ['object', 'attribute'] },
  strings: new Set(['string']),
  calls: { call: ['function', 'arguments'] },
  importsOf: (node) => {
    if (node.type === 'import_from_statement') {
      const specifier = field(node, 'module_name')?.text ?? '';

      return fields(node, 'name').flatMap((name): GrammarImport[] => {
        const imported =
          name.type === 'aliased_import' ? field(name, 'name') : name;
        const alias =
          name.type === 'aliased_import' ? field(name, 'alias') : null;
        const text = imported?.text.split('.').pop();

        return text
          ? [{ local: alias?.text ?? text, imported: text, specifier }]
          : [];
      });
    }

    if (node.type === 'import_statement') {
      return fields(node, 'name').flatMap((name): GrammarImport[] => {
        const imported =
          name.type === 'aliased_import' ? field(name, 'name') : name;
        const alias =
          name.type === 'aliased_import' ? field(name, 'alias') : null;

        return imported
          ? [
              {
                local: alias?.text ?? imported.text,
                imported: '*',
                specifier: imported.text,
              },
            ]
          : [];
      });
    }

    return null;
  },
  resolve: (specifier, from, paths) => {
    const dots = specifier.match(/^\.*/)?.[0].length ?? 0;
    const rest = specifier.slice(dots).replace(/\./g, '/');

    if (dots === 0) {
      return endingIn(paths, moduleFiles(rest));
    }

    let base = dirname(from);
    for (let up = 1; up < dots; up += 1) {
      base = dirname(base);
    }

    const wanted = new Set(moduleFiles(joined(base, rest)));
    return paths.filter((path) => wanted.has(path));
  },
  project: (specifier) => specifier.startsWith('.'),
  exportedAs: (_definition, name) => [name],
};
