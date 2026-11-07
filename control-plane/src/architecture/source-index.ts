import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

export const SOURCE_ROOT = resolve(__dirname, '..');

const COMPILER_PATHS = (
  ts.readConfigFile(join(SOURCE_ROOT, '..', 'tsconfig.json'), ts.sys.readFile)
    .config as { compilerOptions: { paths: Record<string, string[]> } }
).compilerOptions.paths;

const ALIASES: readonly (readonly [string, string])[] = Object.entries(
  COMPILER_PATHS,
)
  .map(([alias, [folder]]): readonly [string, string] => [
    alias.replace(/\*$/, ''),
    (folder as string).replace(/^\.\/src\//, '').replace(/\*$/, ''),
  ])
  .sort(([one], [other]) => other.length - one.length);

export type SourceFile = {
  readonly path: string;
  readonly tree: ts.SourceFile;
};

export const isSpec = (path: string): boolean =>
  /\.(spec|fake-spec|e2e-spec)\.ts$/.test(path);

export const contextOf = (path: string): string | null =>
  /^contexts\/([^/]+)\//.exec(path)?.[1] ?? null;

export const layerOf = (path: string): string | null =>
  /^contexts\/[^/]+\/([^/]+)\//.exec(path)?.[1] ?? null;

export const CONTEXTS: readonly string[] = readdirSync(
  join(SOURCE_ROOT, 'contexts'),
  { withFileTypes: true },
)
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const walk = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const at = join(folder, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : walk(at);
    }

    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')
      ? [at]
      : [];
  });

const parsed = new Map<string, SourceFile>();

export const sourceFile = (path: string): SourceFile => {
  const known = parsed.get(path);

  if (known) {
    return known;
  }

  const file = {
    path,
    tree: ts.createSourceFile(
      path,
      readFileSync(join(SOURCE_ROOT, path), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    ),
  };
  parsed.set(path, file);

  return file;
};

export const sourceFiles = (
  folder = '',
  { specs = false }: { specs?: boolean } = {},
): SourceFile[] =>
  walk(join(SOURCE_ROOT, folder))
    .map((at) => relative(SOURCE_ROOT, at))
    .filter((path) => specs || !isSpec(path))
    .sort()
    .map(sourceFile);

export const moduleTarget = (
  from: string,
  specifier: string,
): string | null => {
  if (specifier.startsWith('.')) {
    return relative(
      SOURCE_ROOT,
      resolve(SOURCE_ROOT, dirname(from), specifier),
    );
  }

  for (const [alias, folder] of ALIASES) {
    if (specifier.startsWith(alias)) {
      return `${folder}${specifier.slice(alias.length)}`;
    }
  }

  return null;
};

export type ImportedName = {
  readonly local: string;
  readonly exported: string;
  readonly target: string;
};

export const importsOf = (file: SourceFile): ImportedName[] =>
  file.tree.statements.flatMap((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [];
    }

    const target = moduleTarget(file.path, statement.moduleSpecifier.text);
    const bindings = statement.importClause?.namedBindings;

    if (!target) {
      return [];
    }

    if (!bindings || !ts.isNamedImports(bindings)) {
      return bindings && ts.isNamespaceImport(bindings)
        ? [{ local: bindings.name.text, exported: '*', target }]
        : [];
    }

    return bindings.elements.map((element) => ({
      local: element.name.text,
      exported: (element.propertyName ?? element.name).text,
      target,
    }));
  });

export const moduleSpecifiersOf = (file: SourceFile): string[] => {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      found.push(node.argument.literal.text);
    }

    ts.forEachChild(node, visit);
  };
  visit(file.tree);

  return found;
};

export const descendants = <T extends ts.Node>(
  root: ts.Node,
  matches: (node: ts.Node) => node is T,
): T[] => {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (matches(node)) {
      found.push(node);
    }

    ts.forEachChild(node, visit);
  };
  visit(root);

  return found;
};

export const withoutExtension = (path: string): string =>
  path.replace(/\.ts$/, '');
