import type { SymbolKind } from '@change-review/domain/services/symbol-index';
import type { Node } from '@vscode/tree-sitter-wasm';

export interface GrammarImport {
  readonly local: string;
  readonly imported: string;
  readonly specifier: string;
}

export interface GrammarRoute {
  readonly method: string;
  readonly path: string;
}

export type Scope = 'file' | 'directory' | 'language';

export interface Grammar {
  readonly name: string;
  readonly wasm: string;
  readonly extensions: RegExp;
  readonly scope: Scope;
  readonly definitions: Readonly<Record<string, SymbolKind>>;
  readonly namesOf?: (node: Node) => readonly Node[];
  readonly hosts: ReadonlySet<string>;
  readonly bodies: ReadonlySet<string>;
  readonly identifiers: ReadonlySet<string>;
  readonly members: Readonly<Record<string, readonly [string, string]>>;
  readonly strings: ReadonlySet<string>;
  readonly calls: Readonly<Record<string, readonly [string, string]>>;
  readonly importsOf: (node: Node) => readonly GrammarImport[] | null;
  readonly resolve: (
    specifier: string,
    from: string,
    paths: readonly string[],
  ) => string[];
  readonly project: (specifier: string) => boolean;
  readonly exportedAs: (definition: Node, name: string) => string[];
  readonly aliases?: (node: Node) => readonly [string, string][];
  readonly prefixOf?: (host: Node) => string | null;
  readonly routeOf?: (node: Node) => GrammarRoute | null;
  readonly components?: boolean;
}

export const named = (node: Node | null): Node[] =>
  (node?.namedChildren ?? []).filter((child): child is Node => child !== null);

export const field = (node: Node, name: string): Node | null =>
  node.childForFieldName(name);

export const fields = (node: Node, name: string): Node[] =>
  node
    .childrenForFieldName(name)
    .filter((child): child is Node => child !== null);

export const unquoted = (text: string): string =>
  text.replace(/^[a-zA-Z]{0,2}(['"`]{1,3})/, '').replace(/(['"`]{1,3})$/, '');

export const withoutExtension = (path: string): string =>
  path.replace(/\.[^./]+$/, '');

export const dirname = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export const joined = (from: string, relative: string): string => {
  const parts: string[] = from ? from.split('/') : [];

  for (const part of relative.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part && part !== '.') {
      parts.push(part);
    }
  }

  return parts.join('/');
};

export const endingIn = (
  paths: readonly string[],
  endings: readonly string[],
): string[] =>
  paths.filter((path) =>
    endings.some((ending) => path === ending || path.endsWith(`/${ending}`)),
  );

export const HTTP_VERBS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);

export const ANY_VERBS = new Set([
  'all',
  'any',
  'route',
  'handle',
  'handlefunc',
  'match',
]);
