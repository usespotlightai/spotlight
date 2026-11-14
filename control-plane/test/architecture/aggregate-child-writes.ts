import ts from 'typescript';

import { AGGREGATE_TABLE_NAMES } from './aggregate-versions';
import {
  SNAPSHOT_FOREIGN_KEYS,
  SNAPSHOT_TABLE_NAMES,
  SNAPSHOT_VERSIONED_TABLES,
} from './drizzle-snapshot';
import { tableBindingsOf } from './drizzle-tables';
import {
  descendants,
  moduleSpecifiersOf,
  moduleTarget,
  type SourceFile,
  sourceFiles,
  withoutExtension,
} from './source-index';
import type { Violation } from './violation';

interface DeclaredWriters {
  readonly why: string;
  readonly childOf?: string;
  readonly writers: readonly string[];
}

const TABLE_WRITERS: Readonly<Record<string, DeclaredWriters>> = {
  catalog_call: {
    why: 'append-only ledger of catalog tool calls, kept for metering',
    writers: [
      'contexts/catalog/infrastructure/persistence/drizzle/ledgers/catalog-call.ledger.ts',
    ],
  },
  chat_record: {
    why: 'Insights ledger of chats, written from chat events',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/ledgers/chats.ledger.ts',
    ],
  },
  configuration_change: {
    why: 'Identity audit projection of shared-kernel ConfigurationChange events (owner decision)',
    writers: [
      'contexts/identity/infrastructure/persistence/drizzle/configuration-audit.ts',
    ],
  },
  deleted_task: {
    why: 'Insights tombstone ledger, so history keeps the names of deleted tasks',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger.ts',
    ],
  },
  deleted_team: {
    why: 'Insights tombstone ledger, so history keeps the names of deleted teams',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger.ts',
    ],
  },
  deleted_workspace: {
    why: 'Insights tombstone ledger, so history keeps the names of deleted workspaces',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger.ts',
    ],
  },
  event_delivery: {
    why: 'platform outbox bookkeeping of each delivery to a subscriber',
    writers: [
      'platform/events/event-delivery.ts',
      'platform/events/event-outbox.ts',
    ],
  },
  event_outbox: {
    why: 'platform transactional outbox of integration events, trimmed once delivered',
    writers: [
      'platform/events/event-outbox.ts',
      'platform/events/outbox-retention.ts',
    ],
  },
  idempotent_create: {
    why: 'platform ledger of idempotency keys for create requests',
    writers: ['platform/idempotency/drizzle-idempotent-creates.ts'],
  },
  memory_use: {
    why: 'append-only ledger of memory uses, persisted with RecordedMemoryUses (DECISIONS configuration-memory)',
    childOf: 'memory',
    writers: [
      'contexts/memory/infrastructure/persistence/drizzle/repositories/memory-uses.ledger.ts',
    ],
  },
  oauth2_spent_nonce: {
    why: 'ledger of spent OAuth2 state nonces, refuses a replayed callback',
    writers: [
      'contexts/integrations/infrastructure/persistence/drizzle/ledgers/oauth2-spent-nonces.ledger.ts',
    ],
  },
  oidc_trust_usage: {
    why: 'last-used stamps of an OIDC trust, written on every exchange without loading the trust (DECISIONS r2-review-seams RS-16)',
    childOf: 'oidc_trust',
    writers: [
      'contexts/identity/infrastructure/persistence/drizzle/oidc-trust-usage.ts',
    ],
  },
  processed_event: {
    why: 'Work ledger of processed events, keeps reactions at most once per event',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/ledgers/processed-events.ledger.ts',
    ],
  },
  pull_request_fact: {
    why: 'Insights projection of pull request events',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/projections/pull-request-facts.projection.ts',
    ],
  },
  replay_outcome: {
    why: 'documented projection of Replay.outcome(), written inside the Replay repository save (DECISIONS r3-an-10)',
    childOf: 'replay',
    writers: [
      'contexts/replays/infrastructure/persistence/drizzle/projections/replay-outcomes.projection.ts',
    ],
  },
  review_delivery: {
    why: 'Change Review queue of leased deliveries to GitHub, work items and no aggregate',
    writers: [
      'contexts/change-review/infrastructure/persistence/drizzle/repositories/review-deliveries.repository.ts',
    ],
  },
  run_connection: {
    why: 'Runs append-only ledger of the connections a run made',
    writers: [
      'contexts/runs/infrastructure/persistence/drizzle/ledgers/run-connections.ledger.ts',
    ],
  },
  run_fact: {
    why: 'Insights CQRS read side of runs (sanctioned)',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/projections/run-facts.projection.ts',
    ],
  },
  run_journal_entry: {
    why: 'Runs append-only journal the runner reports',
    writers: [
      'contexts/runs/infrastructure/persistence/drizzle/ledgers/run-journal.ledger.ts',
    ],
  },
  run_usage: {
    why: 'Runs append-only ledger of model usage per run',
    writers: [
      'contexts/runs/infrastructure/persistence/drizzle/ledgers/run-usages.ledger.ts',
    ],
  },
  secret_data_key: {
    why: 'per-workspace data keys of the secrets envelope encryption',
    writers: ['contexts/secrets/infrastructure/crypto/workspace-keys.ts'],
  },
  secret_value: {
    why: 'vault of the built-in secret source, written by the store and not by the Secret aggregate (DECISIONS r2-review-seams RS-16)',
    childOf: 'secret',
    writers: [
      'contexts/secrets/infrastructure/sources/built-in-secret.store.ts',
    ],
  },
  signup_survey: {
    why: 'answers of the signup survey, stored beside the workspace and no part of the Workspace aggregate (DECISIONS r2-review-seams RS-16)',
    childOf: 'workspace',
    writers: [
      'contexts/identity/infrastructure/persistence/drizzle/signup-surveys.ts',
    ],
  },
  task_draft_state: {
    why: 'Yjs state of a shared task draft, written by the collaboration server',
    writers: [
      'contexts/work/infrastructure/collab/drizzle-task-draft-states.ts',
    ],
  },
  task_pull_request_fact: {
    why: 'Insights projection that links tasks to pull requests',
    writers: [
      'contexts/insights/infrastructure/persistence/drizzle/projections/run-facts.projection.ts',
    ],
  },
  team_welcome: {
    why: 'Work ledger that sends the team welcome once',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/ledgers/team-welcomes.ledger.ts',
    ],
  },
  tool_use: {
    why: 'Work append-only ledger of tool uses',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/ledgers/tool-uses.ledger.ts',
    ],
  },
  turn_retake: {
    why: 'Work ledger of turn retake claims, a compare-and-set guard per threshold',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/ledgers/turn-retakes.ledger.ts',
    ],
  },
  used_token: {
    why: 'Runners ledger of spent single-use tokens',
    writers: [
      'contexts/runners/infrastructure/persistence/drizzle/ledgers/used-tokens.ledger.ts',
    ],
  },
  verification_send: {
    why: 'Identity rate-limit ledger of verification sends',
    writers: [
      'contexts/identity/infrastructure/persistence/drizzle/ledgers/verification-send.ledger.ts',
    ],
  },
  work_line: {
    why: 'Work local projection of Lines, row-locked by the station deletion guard',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/projections/work-stations.projection.ts',
      'contexts/work/infrastructure/persistence/drizzle/station-deletion.guard.ts',
    ],
  },
  work_station: {
    why: 'Work local projection of Lines stations, row-locked by the station deletion guard',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/projections/work-stations.projection.ts',
      'contexts/work/infrastructure/persistence/drizzle/station-deletion.guard.ts',
    ],
  },
  work_team: {
    why: 'Work local projection of the team keys, with the next task number of each team',
    writers: [
      'contexts/work/infrastructure/persistence/drizzle/projections/work-teams.projection.ts',
      'contexts/work/infrastructure/persistence/drizzle/repositories/task.repository.ts',
    ],
  },
  workspace_plan: {
    why: 'Catalog plan record of a workspace, removed with the workspace',
    writers: [
      'contexts/catalog/infrastructure/persistence/drizzle/workspace-plan-deletion.ts',
    ],
  },
};

const LIBRARY_TABLES: Readonly<Record<string, string>> = {
  account: 'Better Auth accounts',
  device_code: 'Better Auth device authorization codes',
  session: 'Better Auth sessions',
  user: 'Better Auth users',
  verification: 'Better Auth verification tokens',
};

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
        ([, name]) => name,
      );
      const interpolated = ts.isNoSubstitutionTemplateLiteral(template)
        ? []
        : template.templateSpans.flatMap((span, index) =>
            RAW_WRITE_BEFORE_TABLE.test(texts[index])
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
    const writers = TABLE_WRITERS[table]?.writers;

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

    if (table in LIBRARY_TABLES) {
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
      !(table in LIBRARY_TABLES),
  ).map((table) => ({
    key: `${table}: unversioned table with no aggregate root, declared writer or library owner`,
    at: table,
  }));

const isOneLine = (why: string): boolean =>
  why.trim().length > 0 && !why.includes('\n');

const unexplainedTables = (): Violation[] =>
  [
    ...Object.entries(TABLE_WRITERS).map(([table, { why }]) => [table, why]),
    ...Object.entries(LIBRARY_TABLES),
  ]
    .filter(([, why]) => !isOneLine(why))
    .map(([table]) => ({
      key: `${table}: declared without a one-line reason`,
      at: table,
    }));

const childrenWrittenApart = (): Violation[] =>
  Object.entries(TABLE_WRITERS).flatMap(([table, { childOf }]) => {
    const roots = [...rootsOf(table)].sort().join(', ');

    if (roots === (childOf ?? '')) {
      return [];
    }

    return [
      {
        key: roots
          ? `${table}: declared writer of a child of ${roots} without childOf ${roots}`
          : `${table}: declared as a child of ${childOf}, but it has no aggregate root`,
        at: table,
      },
    ];
  });

const staleWriters = (files: readonly SourceFile[]): Violation[] =>
  Object.entries(TABLE_WRITERS).flatMap(([table, { writers }]) =>
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
    ...unexplainedTables(),
  ];
};
