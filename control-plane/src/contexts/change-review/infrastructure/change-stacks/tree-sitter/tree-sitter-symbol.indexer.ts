import path from 'node:path';
import type { DiffSource } from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import type {
  IndexedFile,
  IndexedReference,
  IndexedRouteUse,
  IndexedSymbol,
  SymbolIndex,
} from '@change-review/domain/services/symbol-index';
import { CSHARP_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/csharp.grammar';
import { GO_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/go.grammar';
import {
  ANY_VERBS,
  dirname,
  field,
  type Grammar,
  type GrammarImport,
  HTTP_VERBS,
  named,
  unquoted,
} from '@change-review/infrastructure/change-stacks/tree-sitter/grammar';
import { JAVA_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/java.grammar';
import { PHP_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/php.grammar';
import { PYTHON_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/python.grammar';
import { RUBY_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/ruby.grammar';
import { RUST_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/rust.grammar';
import { TERRAFORM_GRAMMAR } from '@change-review/infrastructure/change-stacks/tree-sitter/terraform.grammar';
import { TYPESCRIPT_GRAMMARS } from '@change-review/infrastructure/change-stacks/tree-sitter/typescript.grammar';
import { Language, type Node, Parser } from '@vscode/tree-sitter-wasm';

const GRAMMARS: readonly Grammar[] = [
  ...TYPESCRIPT_GRAMMARS,
  GO_GRAMMAR,
  PYTHON_GRAMMAR,
  JAVA_GRAMMAR,
  RUST_GRAMMAR,
  RUBY_GRAMMAR,
  PHP_GRAMMAR,
  CSHARP_GRAMMAR,
  TERRAFORM_GRAMMAR,
];

const MAX_SOURCE_LENGTH = 512 * 1024;

const THROUGH = /^[\w$.:]{1,60}$/;

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

interface Context {
  readonly inBody: boolean;
  readonly inHost: boolean;
  readonly inImport: boolean;
  readonly prefix: string;
}

interface Walked {
  readonly symbols: IndexedSymbol[];
  readonly imports: GrammarImport[];
  readonly references: IndexedReference[];
  readonly routeUses: IndexedRouteUse[];
}

const familyOf = (grammar: Grammar): string =>
  TYPESCRIPT_GRAMMARS.includes(grammar) ? 'javascript' : grammar.name;

const lineOf = (node: Node): number => node.startPosition.row + 1;

const routePath = (...parts: string[]): string =>
  `/${parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')}`;

const stringText = (grammar: Grammar, node: Node): string => {
  const text = unquoted(node.text)
    .replace(/\$\{[^}]*\}/g, ':param')
    .replace(/#\{[^}]*\}/g, ':param');

  return grammar.interpolations
    ? text.replace(grammar.interpolations, ':param')
    : text;
};

const calleeName = (callee: Node | null): string =>
  callee?.text.split(/[.:]/).pop()?.trim() ?? '';

const firstString = (
  grammar: Grammar,
  argumentsNode: Node | null,
): Node | null =>
  named(argumentsNode).find((child) => grammar.strings.has(child.type)) ?? null;

const wholeFileComponent = (source: DiffSource): IndexedSymbol => ({
  name: path.basename(source.path).replace(/\.[^.]+$/, ''),
  kind: 'component',
  line: 1,
  endLine: source.text.split('\n').length,
  exportedAs: ['default'],
});

const walk = (grammar: Grammar, root: Node): Walked => {
  const walked: Walked = {
    symbols: [],
    imports: [],
    references: [],
    routeUses: [],
  };
  const skipped = new Set<number>();
  const aliases: [string, string][] = [];
  const stack: [Node, Context][] = [
    [root, { inBody: false, inHost: false, inImport: false, prefix: '' }],
  ];

  while (stack.length > 0) {
    const [node, context] = stack.pop() as [Node, Context];
    let prefix = context.prefix;
    let inImport = context.inImport;

    const imports = grammar.importsOf(node);
    if (imports) {
      walked.imports.push(...imports);
      inImport = true;
    }

    aliases.push(...(grammar.aliases?.(node) ?? []));

    walked.references.push(...(grammar.referencesOf?.(node) ?? []));

    const defined = grammar.definitions[node.type];
    if (defined && !context.inBody && !inImport) {
      const names = grammar.namesOf?.(node) ?? [field(node, 'name')];

      for (const name of names) {
        if (!name) {
          continue;
        }

        skipped.add(name.id);

        const text = grammar.nameOf?.(node, name) ?? name.text;
        const kind =
          defined === 'function' && context.inHost
            ? 'method'
            : grammar.components &&
                (defined === 'function' || defined === 'constant') &&
                PASCAL_CASE.test(text)
              ? 'component'
              : defined;

        walked.symbols.push({
          name: text,
          kind,
          line: lineOf(name),
          endLine: node.endPosition.row + 1,
          exportedAs: grammar.exportedAs(node, text),
        });
      }

      if (defined === 'class') {
        prefix = grammar.prefixOf?.(node) ?? prefix;
      }
    }

    const route = grammar.routeOf?.(node);
    if (route) {
      walked.symbols.push({
        name: `${route.method} ${routePath(route.absolute ? '' : prefix, route.path)}`,
        kind: 'route',
        line: lineOf(node),
        endLine: node.endPosition.row + 1,
        exportedAs: [],
      });
      for (const each of node.descendantsOfType([...grammar.strings])) {
        if (each) {
          skipped.add(each.id);
        }
      }
    }

    const call = grammar.calls[node.type];
    if (call && !route) {
      const verb = calleeName(field(node, call[0])).toLowerCase();
      const argument = firstString(grammar, field(node, call[1]));
      const literal = argument ? stringText(grammar, argument) : '';

      if (
        argument &&
        !skipped.has(argument.id) &&
        literal.startsWith('/') &&
        (HTTP_VERBS.has(verb) || ANY_VERBS.has(verb))
      ) {
        walked.symbols.push({
          name: `${HTTP_VERBS.has(verb) ? verb.toUpperCase() : 'ANY'} ${routePath(literal)}`,
          kind: 'route',
          line: lineOf(node),
          endLine: node.endPosition.row + 1,
          exportedAs: [],
        });
        skipped.add(argument.id);
      }
    }

    const member = grammar.members[node.type];
    if (member && !inImport) {
      const object = field(node, member[0]);
      const property = field(node, member[1]);

      if (object && property && !skipped.has(property.id)) {
        walked.references.push({
          name: property.text,
          line: lineOf(property),
          through: THROUGH.test(object.text) ? object.text : '.',
        });
        skipped.add(property.id);
      }
    }

    if (
      grammar.identifiers.has(node.type) &&
      !inImport &&
      !skipped.has(node.id)
    ) {
      walked.references.push({
        name: node.text,
        line: lineOf(node),
        through: null,
      });
    }

    if (grammar.strings.has(node.type) && !inImport && !skipped.has(node.id)) {
      const text = stringText(grammar, node);

      if (
        text.includes('/') &&
        !/\s/.test(text) &&
        !text.startsWith('.') &&
        text.length < 200
      ) {
        walked.routeUses.push({ path: text, line: lineOf(node) });
      }
    }

    const next: Context = {
      inBody: context.inBody || grammar.bodies.has(node.type),
      inHost: grammar.hosts.has(node.type)
        ? true
        : grammar.bodies.has(node.type)
          ? false
          : context.inHost,
      inImport,
      prefix,
    };

    const children = grammar.opaque?.has(node.type) ? [] : node.children;
    for (let at = children.length - 1; at >= 0; at -= 1) {
      const child = children[at];
      if (child) {
        stack.push([child, next]);
      }
    }
  }

  const exported = new Map<string, string[]>();
  for (const [name, as] of aliases) {
    exported.set(name, [...(exported.get(name) ?? []), as]);
  }

  return {
    ...walked,
    symbols: walked.symbols.map((symbol) =>
      exported.has(symbol.name) && symbol.kind !== 'route'
        ? {
            ...symbol,
            exportedAs: [
              ...new Set([
                ...symbol.exportedAs,
                ...(exported.get(symbol.name) ?? []),
              ]),
            ],
          }
        : symbol,
    ),
  };
};

export class TreeSitterSymbolIndexer implements SymbolIndexerPort {
  private readonly directory = path.dirname(
    require.resolve('@vscode/tree-sitter-wasm'),
  );

  private loading: Promise<Map<string, Language>> | null = null;

  async index(sources: readonly DiffSource[]): Promise<SymbolIndex> {
    const readable = sources.flatMap((source) => {
      const grammar = GRAMMARS.find(({ extensions }) =>
        extensions.test(source.path),
      );

      return grammar && source.text.length <= MAX_SOURCE_LENGTH
        ? [{ source, grammar }]
        : [];
    });

    if (readable.length === 0) {
      return { files: [] };
    }

    const languages = await this.languages();
    const parser = new Parser();

    try {
      const walked = readable.flatMap(({ source, grammar }) => {
        const language = languages.get(grammar.wasm);

        if (!language) {
          return [];
        }

        parser.setLanguage(language);
        const embedded = grammar.embedded?.(source.text);
        const tree = parser.parse(embedded?.script ?? source.text);

        if (!tree) {
          return [];
        }

        try {
          const found = walk(grammar, tree.rootNode);

          return [
            {
              source,
              grammar,
              walked: embedded
                ? {
                    ...found,
                    symbols: [wholeFileComponent(source), ...found.symbols],
                    references: [...found.references, ...embedded.references],
                  }
                : found,
            },
          ];
        } finally {
          tree.delete();
        }
      });

      const pathsOf = (side: DiffSource['side'], family: string) =>
        walked
          .filter(
            (each) =>
              each.source.side === side && familyOf(each.grammar) === family,
          )
          .map((each) => each.source.path);

      return {
        files: walked.map(({ source, grammar, walked: found }): IndexedFile => {
          const paths = pathsOf(source.side, familyOf(grammar));

          return {
            path: source.path,
            side: source.side,
            scope:
              grammar.scope === 'file'
                ? [source.path]
                : grammar.scope === 'directory'
                  ? paths.filter(
                      (each) => dirname(each) === dirname(source.path),
                    )
                  : paths,
            symbols: found.symbols,
            imports: found.imports.map((each) => ({
              ...each,
              resolved: grammar
                .resolve(each.specifier, source.path, paths)
                .filter((resolved) => resolved !== source.path),
              project: grammar.project(each.specifier),
            })),
            references: found.references,
            routeUses: found.routeUses,
          };
        }),
      };
    } finally {
      parser.delete();
    }
  }

  private languages(): Promise<Map<string, Language>> {
    this.loading ??= (async () => {
      await Parser.init({
        locateFile: (file: string) => path.join(this.directory, file),
      });

      const loaded = await Promise.all(
        [...new Set(GRAMMARS.map((grammar) => grammar.wasm))].map(
          async (wasm) =>
            [
              wasm,
              await Language.load(path.resolve(this.directory, wasm)),
            ] as const,
        ),
      );

      return new Map(loaded);
    })().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });

    return this.loading;
  }
}
