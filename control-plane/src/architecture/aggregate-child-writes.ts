import ts from 'typescript';
import { AGGREGATE_TABLE_NAMES } from './aggregate-versions';
import {
  SNAPSHOT_FOREIGN_KEYS,
  SNAPSHOT_TABLE_NAMES,
  SNAPSHOT_VERSIONED_TABLES,
} from './drizzle-snapshot';
import { tableBindingsOf } from './drizzle-tables';
import type { Violation } from './known-violations';
import {
  descendants,
  moduleSpecifiersOf,
  moduleTarget,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';

const TABLE_WRITERS: Readonly<Record<string, readonly string[]>> = {
  catalog_call: [
    'contexts/catalog/infrastructure/persistence/drizzle/ledgers/catalog-call.ledger.ts',
  ],
  chat_record: [
    'contexts/insights/infrastructure/persistence/drizzle/ledgers/chats.ledger.ts',
  ],
  configuration_change: [
    'contexts/identity/infrastructure/persistence/drizzle/configuration-audit.ts',
  ],
  deleted_task: [
    'contexts/insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger.ts',
  ],
  deleted_team: [
    'contexts/insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger.ts',
  ],
  deleted_workspace: [
    'contexts/insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger.ts',
  ],
  event_delivery: [
    'platform/events/event-delivery.ts',
    'platform/events/event-outbox.ts',
  ],
  event_outbox: ['platform/events/event-outbox.ts'],
  idempotent_create: ['platform/idempotency/drizzle-idempotent-creates.ts'],
  memory_use: [
    'contexts/memory/infrastructure/persistence/drizzle/repositories/memory-uses.ledger.ts',
  ],
  oauth2_spent_nonce: [
    'contexts/integrations/infrastructure/persistence/drizzle/ledgers/oauth2-spent-nonces.ledger.ts',
  ],
  oidc_trust_usage: [
    'contexts/identity/infrastructure/persistence/drizzle/oidc-trust-usage.ts',
  ],
  processed_event: [
    'contexts/work/infrastructure/persistence/drizzle/ledgers/processed-events.ledger.ts',
  ],
  pull_request_fact: [
    'contexts/insights/infrastructure/persistence/drizzle/projections/pull-request-facts.projection.ts',
  ],
  replay_outcome: [
    'contexts/replays/infrastructure/persistence/drizzle/projections/replay-outcomes.projection.ts',
  ],
  review_delivery: [
    'contexts/change-review/infrastructure/persistence/drizzle/repositories/review-deliveries.repository.ts',
  ],
  run_connection: [
    'contexts/runs/infrastructure/persistence/drizzle/ledgers/run-connections.ledger.ts',
  ],
  run_fact: [
    'contexts/insights/infrastructure/persistence/drizzle/projections/run-facts.projection.ts',
  ],
  run_journal_entry: [
    'contexts/runs/infrastructure/persistence/drizzle/ledgers/run-journal.ledger.ts',
  ],
  run_usage: [
    'contexts/runs/infrastructure/persistence/drizzle/ledgers/run-usages.ledger.ts',
  ],
  secret_data_key: ['contexts/secrets/infrastructure/crypto/workspace-keys.ts'],
  secret_value: [
    'contexts/secrets/infrastructure/sources/built-in-secret.store.ts',
  ],
  signup_survey: [
    'contexts/identity/infrastructure/persistence/drizzle/signup-surveys.ts',
  ],
  task_draft_state: [
    'contexts/work/infrastructure/collab/drizzle-task-draft-states.ts',
  ],
  task_pull_request_fact: [
    'contexts/insights/infrastructure/persistence/drizzle/projections/run-facts.projection.ts',
  ],
  team_welcome: [
    'contexts/work/infrastructure/persistence/drizzle/ledgers/team-welcomes.ledger.ts',
  ],
  tool_use: [
    'contexts/work/infrastructure/persistence/drizzle/ledgers/tool-uses.ledger.ts',
  ],
  turn_retake: [
    'contexts/work/infrastructure/persistence/drizzle/ledgers/turn-retakes.ledger.ts',
  ],
  used_token: [
    'contexts/runners/infrastructure/persistence/drizzle/ledgers/used-tokens.ledger.ts',
  ],
  verification_send: [
    'contexts/identity/infrastructure/persistence/drizzle/ledgers/verification-send.ledger.ts',
  ],
  work_line: [
    'contexts/work/infrastructure/persistence/drizzle/projections/work-stations.projection.ts',
    'contexts/work/infrastructure/persistence/drizzle/station-deletion.guard.ts',
  ],
  work_station: [
    'contexts/work/infrastructure/persistence/drizzle/projections/work-stations.projection.ts',
    'contexts/work/infrastructure/persistence/drizzle/station-deletion.guard.ts',
  ],
  workspace_plan: [
    'contexts/catalog/infrastructure/persistence/drizzle/workspace-plan-deletion.ts',
  ],
};

const CHILDREN_WRITTEN_APART: Readonly<Record<string, string>> = {
  memory_use:
    'append-only ledger of memory uses, persisted with RecordedMemoryUses (DECISIONS configuration-memory)',
  oidc_trust_usage:
    'last-used stamps of an OIDC trust, written on every exchange without loading the trust (DECISIONS r2-review-seams RS-16)',
  replay_outcome:
    'documented projection of Replay.outcome(), written inside the Replay repository save (DECISIONS r3-an-10)',
  secret_value:
    'vault of the built-in secret source, written by the store and not by the Secret aggregate (DECISIONS r2-review-seams RS-16)',
  signup_survey:
    'answers of the signup survey, stored beside the workspace and no part of the Workspace aggregate (DECISIONS r2-review-seams RS-16)',
};

const LIBRARY_TABLES: ReadonlySet<string> = new Set([
  'account',
  'device_code',
  'session',
  'user',
  'verification',
]);

const isAggregateTable = (name: string): boolean =>
  SNAPSHOT_VERSIONED_TABLES.has(name) || AGGREGATE_TABLE_NAMES.has(name);

const rootsOf = (table: string, seen = new Set<string>()): Set<string> => {
  if (seen.has(table)) {
    return new Set();
  }

  seen.add(table);

  return new Set(
    SNAPSHOT_FOREIGN_KEYS.filter((key) => key.tableFrom === table).flatMap(
      (key) =>
        isAggregateTable(key.tableTo)
          ? [key.tableTo]
          : [...rootsOf(key.tableTo, seen)],
    ),
  );
};

const CHILD_TABLE_ROOTS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  [...new Set(SNAPSHOT_FOREIGN_KEYS.map((key) => key.tableFrom))]
    .filter((table) => !isAggregateTable(table) && !(table in TABLE_WRITERS))
    .map((table) => [table, rootsOf(table)] as const)
    .filter(([, roots]) => roots.size > 0),
);

const WRITE_METHODS: ReadonlySet<string> = new Set([
  'insert',
  'update',
  'delete',
]);

const TABLE_NAME = String.raw`(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?`;
const RAW_WRITE = new RegExp(
  String.raw`\b(?:update|delete\s+from|insert\s+into)\s+${TABLE_NAME}`,
  'gi',
);
const RAW_WRITE_BEFORE_TABLE = /\b(update|delete\s+from|insert\s+into)\s*"?$/i;

const builderWrites = (file: SourceFile): string[] => {
  const tables = tableBindingsOf(file);

  return descendants(file.tree, ts.isCallExpression).flatMap((call) => {
    const argument = call.arguments[0];

    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      !WRITE_METHODS.has(call.expression.name.text) ||
      !argument
    ) {
      return [];
    }

    const table = tables.get(argument.getText());

    return table ? [table.name] : [];
  });
};

const rawWrites = (file: SourceFile): string[] => {
  const tables = tableBindingsOf(file);

  return descendants(file.tree, ts.isTaggedTemplateExpression)
    .filter((tagged) => /^sql\b/.test(tagged.tag.getText()))
    .flatMap((tagged) => {
      const template = tagged.template;
      const texts = ts.isNoSubstitutionTemplateLiteral(template)
        ? [template.text]
        : [
            template.head.text,
            ...template.templateSpans.map((span) => span.literal.text),
          ];
      const named = [...texts.join(' ').matchAll(RAW_WRITE)].map(
        ([, name]) => name as string,
      );
      const interpolated = ts.isNoSubstitutionTemplateLiteral(template)
        ? []
        : template.templateSpans.flatMap((span, index) =>
            RAW_WRITE_BEFORE_TABLE.test(texts[index] as string)
              ? [tables.get(span.expression.getText())?.name ?? []].flat()
              : [],
          );

      return [...named, ...interpolated];
    });
};

const tablesWrittenIn = (file: SourceFile): ReadonlySet<string> =>
  new Set([...builderWrites(file), ...rawWrites(file)]);

const childWritesOf = (
  file: SourceFile,
  rootWriter: (file: SourceFile, roots: ReadonlySet<string>) => boolean,
): Violation[] => {
  const written = tablesWrittenIn(file);

  return [...written].flatMap((table): Violation[] => {
    const writers = TABLE_WRITERS[table];

    if (writers) {
      return writers.includes(file.path)
        ? []
        : [
            {
              key: `${file.path}: writes ${table} outside its declared writers`,
              at: file.path,
            },
          ];
    }

    if (LIBRARY_TABLES.has(table)) {
      return [
        {
          key: `${file.path}: writes ${table}, which its library owns`,
          at: file.path,
        },
      ];
    }

    const roots = CHILD_TABLE_ROOTS.get(table);

    if (!roots || rootWriter(file, roots)) {
      return [];
    }

    return [
      {
        key: `${file.path}: writes ${table} outside the repository of ${[...roots].sort().join(' or ')}`,
        at: file.path,
      },
    ];
  });
};

const unclassifiedTables = (): Violation[] =>
  SNAPSHOT_TABLE_NAMES.filter(
    (table) =>
      !isAggregateTable(table) &&
      !CHILD_TABLE_ROOTS.has(table) &&
      !(table in TABLE_WRITERS) &&
      !LIBRARY_TABLES.has(table),
  ).map((table) => ({
    key: `${table}: unversioned table with no aggregate root, declared writer or library owner`,
    at: table,
  }));

const childrenWrittenApart = (): Violation[] => [
  ...Object.keys(TABLE_WRITERS)
    .filter(
      (table) => rootsOf(table).size > 0 && !(table in CHILDREN_WRITTEN_APART),
    )
    .map((table) => ({
      key: `${table}: declared writer of a child of ${[...rootsOf(table)].join(', ')} without a recorded reason`,
      at: table,
    })),
  ...Object.keys(CHILDREN_WRITTEN_APART)
    .filter((table) => !(table in TABLE_WRITERS) || rootsOf(table).size === 0)
    .map((table) => ({
      key: `${table}: recorded as a child written apart, but it is not a declared child`,
      at: table,
    })),
];

const staleWriters = (files: readonly SourceFile[]): Violation[] =>
  Object.entries(TABLE_WRITERS).flatMap(([table, writers]) =>
    writers
      .filter(
        (path) =>
          !files.some(
            (file) => file.path === path && tablesWrittenIn(file).has(table),
          ),
      )
      .map((path) => ({
        key: `${table}: declared writer ${path} does not write it`,
        at: path,
      })),
  );

const writesARoot = (file: SourceFile, roots: ReadonlySet<string>): boolean => {
  const written = tablesWrittenIn(file);

  return [...roots].some((root) => written.has(root));
};

export const childWritesIn = (file: SourceFile): Violation[] =>
  childWritesOf(file, writesARoot);

export const aggregateChildWriteViolations = (): Violation[] => {
  const files = sourceFiles();
  const importersOf = (file: SourceFile): SourceFile[] =>
    files.filter((each) =>
      moduleSpecifiersOf(each).some(
        (specifier) =>
          moduleTarget(each.path, specifier) === withoutExtension(file.path),
      ),
    );
  const rootWriter = (
    file: SourceFile,
    roots: ReadonlySet<string>,
  ): boolean => {
    if (writesARoot(file, roots)) {
      return true;
    }

    const importers = importersOf(file);

    return (
      importers.length > 0 &&
      importers.every((importer) => writesARoot(importer, roots))
    );
  };

  return [
    ...files.flatMap((file) => childWritesOf(file, rootWriter)),
    ...unclassifiedTables(),
    ...staleWriters(files),
    ...childrenWrittenApart(),
  ];
};
