import type { KnownViolations } from './known-violations';

export const KNOWN_AGGREGATE_CHILD_WRITES: KnownViolations = {
  'contexts/work/infrastructure/persistence/drizzle/ledgers/run-connections.ledger.ts: writes run_connection outside the repository of run':
    { count: 1, finding: 'RUNS' },
  'contexts/work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger.ts: writes run_event outside the repository of run':
    { count: 1, finding: 'RUNS' },
  'contexts/work/infrastructure/persistence/drizzle/ledgers/run-usages.ledger.ts: writes run_usage outside the repository of run':
    { count: 1, finding: 'RUNS' },
};
