import type {
  InboxApprovalResponseDto,
  InboxFailureResponseDto,
  InboxMessageResponseDto,
  JournalStepResponseDto,
  RunSpendResponseDto,
  StepChangeResponseDto,
  TaskPersonResponseDto,
} from '@/lib/api';
import { MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';

export type StepScript = {
  readonly kind?: JournalStepResponseDto['kind'];
  readonly tool?: string;
  readonly text: string;
  readonly detail?: string;
  readonly weight: number;
  readonly status?: 'completed' | 'failed' | 'running';
  readonly locations?: JournalStepResponseDto['locations'];
  readonly change?: StepChangeResponseDto;
};

export type NoteScript = {
  readonly kind: InboxMessageResponseDto['kind'];
  readonly form?: InboxMessageResponseDto['form'];
  readonly body: string;
  readonly author?: TaskPersonResponseDto;
  readonly failure?: InboxFailureResponseDto;
  readonly approval?: InboxApprovalResponseDto;
  readonly minutesAfterEnd?: number;
  readonly minutesIn?: number;
};

export type RunStory = {
  readonly spend: RunSpendResponseDto | null;
  readonly before?: string;
  readonly steps: readonly StepScript[];
  readonly notes: readonly NoteScript[];
  readonly output?: string;
};

export const spend = (
  cost: number,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
): RunSpendResponseDto => ({
  cost,
  currency: 'USD',
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheWriteTokens,
});

export const thought = (text: string, weight = 1): StepScript => ({
  kind: 'thought',
  text,
  weight,
});

export const said = (text: string, weight = 1): StepScript => ({
  kind: 'said',
  text,
  weight,
});

export const planned = (text: string, weight = 1): StepScript => ({
  kind: 'planned',
  text,
  weight,
});

export const read = (path: string, weight = 1): StepScript => ({
  tool: 'read',
  text: path,
  weight,
  locations: [{ path, line: null }],
});

export const execute = (
  text: string,
  detail: string,
  weight: number,
  status: StepScript['status'] = 'completed',
): StepScript => ({ tool: 'execute', text, detail, weight, status });

export const edit = (
  path: string,
  before: string,
  after: string,
  weight = 2,
  status: StepScript['status'] = 'completed',
): StepScript => ({
  tool: before === '' ? 'write' : 'edit',
  text: path,
  weight,
  status,
  locations: [{ path, line: null }],
  change: { path, before, after },
});

export const passed = (body: string): NoteScript => ({ kind: 'passed', body });

export const asked = (
  body: string,
  over: Partial<NoteScript> = {},
): NoteScript => ({ kind: 'asked', body, ...over });

export const answered = (
  author: TaskPersonResponseDto,
  body: string,
  minutesAfterEnd: number,
): NoteScript => ({ kind: 'answered', body, author, minutesAfterEnd });

export const approvalAsked = (
  approval: InboxApprovalResponseDto,
  minutesIn: number,
): NoteScript =>
  asked(`I need your approval before I use \`${approval.name}\`.`, {
    form: 'approval',
    minutesIn,
    approval,
  });

export const decided = (
  author: TaskPersonResponseDto,
  body: string,
  minutesIn: number,
): NoteScript => ({
  kind: 'answered',
  form: 'approval',
  body,
  author,
  minutesIn,
});

export const failedWith = (body: string): NoteScript => ({
  kind: 'asked',
  form: 'failure',
  body,
  failure: { source: 'run', code: 'exited', occurrences: 1 },
});

export const PULL_431 = 'https://github.com/acme/api/pull/431';
export const PULL_412 = 'https://github.com/acme/api/pull/412';
export const PULL_88 = 'https://github.com/acme/web/pull/88';

export const PAID_AT_MIGRATION =
  'migrations/0042_invoice_paid_at_precision.sql';
export const TRIGRAM_MIGRATION = 'migrations/0038_task_title_trigram.sql';

const POOL_BEFORE = `import { native, Pool } from 'pg';
import { env } from '../env';

export const pool = new (native?.Pool ?? Pool)({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  idleTimeoutMillis: 10_000,
});
`;

const POOL_AFTER = `import { Pool } from 'pg';
import { env } from '../env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});
`;

const TIMESTAMPS_BEFORE = `export const paidAt = (row: InvoiceRow): string =>
  new Date(row.paid_at).toISOString();
`;

const TIMESTAMPS_AFTER = `export const paidAt = (row: InvoiceRow): string =>
  row.paid_at.toISOString().replace(/\\.(\\d{3})\\d*Z$/, '.$1Z');
`;

const PAID_AT_SQL = `-- Keep microseconds on paid_at, as pg 8.13 now returns them
ALTER TABLE invoices
  ALTER COLUMN paid_at TYPE timestamptz(6);
`;

const QUERY_BEFORE = `import { pool } from './pool';

export const query = (text: string, values: unknown[]) =>
  pool.query(text, values);
`;

const QUERY_AFTER = `import type { QueryResultRow } from 'pg';
import { pool } from './pool';

export const query = <Row extends QueryResultRow>(
  text: string,
  values: unknown[],
) => pool.query<Row>(text, values);
`;

const PACKAGE_BEFORE = `    "pg": "^8.7.3",
    "pg-native": "^3.0.1",
`;

const PACKAGE_AFTER = `    "pg": "^8.13.1",
`;

const OPEN_INVOICES_BEFORE = `  const { rows } = await query(
    'SELECT * FROM invoices WHERE status = $1 AND workspace_id = $2',
`;

const OPEN_INVOICES_AFTER = `  const { rows } = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE status = $1 AND workspace_id = $2',
`;

const TRIGRAM_SQL = `CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY task_title_trigram
  ON task USING gin (title gin_trgm_ops);
`;

const SEARCH_BEFORE = `    .where(ilike(task.title, contains(term)))
`;

const SEARCH_AFTER = `    .where(similarTo(task.title, term))
    .orderBy(desc(similarity(task.title, term)))
`;

const REFERRAL_SOURCE = `import type { Person } from '@/lib/person';

export const referralUrl = (inviter: Person) =>
  new URL(inviter.referralCode, 'https://acme.dev/r/').href;
`;

const INVITE_BEFORE = `      <Button href={acceptUrl}>Join {team}</Button>
`;

const INVITE_AFTER = `      <Button href={acceptUrl}>Join {team}</Button>
      {flags.inviteReferral && (
        <Text>
          Know someone else who should try it?{" "}
          <Link href={referralUrl(inviter)}>Share your link</Link>
        </Text>
      )}
`;

export const GONE_THOUGHT =
  'Three endpoints answer 410 Gone. They will never come back, so retrying them only fills the queue again.';

export const GONE_REMEMBER =
  'spotlight remember --kind rationale --reach station --path src/retries/deliver.ts --body "A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried."';

export const DRAIN_ANSWER =
  'Start with webhook-retries. Billing is still being reconciled, so leave it alone for now.';

export const DISK_DUMPS_SAID =
  '/var/crash holds 14 GB of core dumps from the image resizer, all from the last three days. Nothing rotates them.';

export const PRICING_FLAG_SAID =
  'Finance has not agreed the 20% annual discount yet, so the design keeps the toggle behind pricing_annual and shows monthly prices to everyone else.';

export const SEARCH_SCAN_THOUGHT =
  'ILIKE with a leading wildcard cannot use an index, so every search scans the whole task table: 1.8 seconds on the largest workspace.';

export const RUN_STORIES: Record<string, RunStory> = {
  run_checkout_1: {
    spend: null,
    steps: [
      thought(
        'It only fails on CI, so look for what CI does differently: parallel workers, a shared database, or slower machines.',
      ),
      execute(
        'gh run list --workflow ci.yml --limit 50 --json conclusion,name',
        '11 of 50 runs failed\nall 11 in web/e2e/checkout.spec.ts',
        2,
      ),
      read('web/e2e/checkout.spec.ts'),
      thought(
        'Run the checkout test twenty times on four workers, the way CI does, to see it fail here.',
      ),
    ],
    notes: [
      approvalAsked(
        {
          kind: 'harness-permission',
          name: 'claude-code execute',
          because: 'The triage harness profile says to ask a person first.',
          inputs: [
            {
              name: 'title',
              value:
                'npx playwright test checkout --repeat-each 20 --workers 4',
            },
          ],
          standing: 'asked',
          edited: null,
          intent: null,
          askedOf: null,
        },
        6,
      ),
    ],
  },
  run_rate_limits_1: {
    spend: spend(0.04, 1_820, 2_310, 84_200, 12_400),
    steps: [
      thought(
        'Partners say the bursts follow their nightly sync. The gateway logs should show which tokens.',
      ),
      execute('rg -n "rateLimit|throttle" src', 'No matches.', 1),
      execute(
        'gateway-logs --since 7d --top-tokens 3',
        'tok_northwind   1,812 req in 60s at 02:00\ntok_globex      1,644 req in 60s at 02:00\ntok_initech       903 req in 60s at 02:01',
        3,
      ),
      read('src/http/public/routes.ts'),
      said(
        'Reproduced: three partner tokens send up to 1,800 requests in the first minute after their nightly sync, and the dashboard slows for everyone. Nothing limits a token today.',
      ),
    ],
    notes: [
      passed(
        'Passed to Spec. Reproduced: three partner tokens send up to **1,800 requests** in the first minute after their nightly sync, and the dashboard slows for everyone. Nothing limits a token today.',
      ),
    ],
    output: 'Three partner tokens burst to 1,800 requests a minute; no limit.',
  },
  run_rate_limits_2: {
    spend: spend(0.92, 4_210, 9_880, 612_000, 41_300),
    before:
      'Triage found three partner tokens sending up to 1,800 requests in the first minute after their nightly sync, and nothing limiting a token.',
    steps: [
      read('src/http/middleware/index.ts'),
      read('src/auth/tokens.ts'),
      thought(
        'The dashboard signs in with a session cookie, never an API token, so a limit per token leaves it alone.',
      ),
      planned(
        '1. A token bucket per API key, kept in Redis\n2. 429 with Retry-After once it is empty\n3. Leave dashboard sessions unlimited',
      ),
      edit(
        'docs/specs/rate-limits.md',
        '',
        '# Rate limits on the public API\n\n- 600 requests a minute per API key, bursts of 100\n- Over the limit: `429 Too Many Requests` with `Retry-After`\n- Dashboard sessions are not limited\n',
        3,
      ),
      said(
        'The spec is in `docs/specs/rate-limits.md`. One question is open: per API key or per workspace.',
      ),
    ],
    notes: [
      asked(
        'The spec is in `docs/specs/rate-limits.md`:\n\n- A token bucket per API key, **600 requests a minute** with bursts of 100\n- Over the limit: `429 Too Many Requests` with `Retry-After`\n- Dashboard sessions are not limited\n\nShould limits apply per API key or per workspace? Per key is fairer to partners with several integrations; per workspace is simpler to explain on the pricing page.',
      ),
    ],
    output: 'Spec: 600 requests a minute per API key, one question open.',
  },
  run_retries_1: {
    spend: spend(0.05, 1_640, 2_020, 91_300, 10_800),
    steps: [
      thought(
        'The worker was redeployed on Friday; check whether it ever picked the queues up again.',
      ),
      execute(
        'queue-stats --all',
        'webhook-retries  1204\nbilling-retries    87\nemail-retries       0',
        1,
      ),
      read('src/retries/worker.ts'),
      execute(
        'kubectl -n worker get deploy retry-worker -o jsonpath="{.spec.template.spec.containers[0].env}"',
        '[{"name":"QUEUE_URL","value":"redis://queue:6379"}]',
        1,
      ),
      said(
        'The worker came back on Friday without `RETRY_CONCURRENCY`, so it takes no jobs at all.',
      ),
    ],
    notes: [
      passed(
        'Passed to Spec. **1,204** webhook jobs and **87** billing jobs are stuck. The worker came back on Friday without `RETRY_CONCURRENCY`, so it takes no jobs at all; nothing in the queues is corrupt.',
      ),
    ],
    output: '1,291 jobs stuck: the worker lost RETRY_CONCURRENCY on Friday.',
  },
  run_retries_2: {
    spend: spend(0.88, 3_920, 8_740, 588_400, 39_600),
    before:
      'Triage found 1,204 webhook jobs and 87 billing jobs stuck, because the worker came back on Friday without `RETRY_CONCURRENCY`.',
    steps: [
      read('src/retries/deliver.ts', 2),
      execute(
        'queue-peek webhook-retries --group-by last-status',
        '503  1,187\n429     14\n410      3',
        3,
      ),
      thought(GONE_THOUGHT),
      edit(
        'docs/specs/drain-retry-queues.md',
        '',
        '# Drain the stuck retry queues\n\n- Restore `RETRY_CONCURRENCY=8` on the worker\n- Replay webhook-retries once the worker is healthy\n- Drop deliveries to endpoints that answer 410 Gone, and record them as gone\n- Leave billing-retries until billing is reconciled\n',
        3,
      ),
      execute(GONE_REMEMBER, 'Proposed for the team to approve.', 1),
      said('The spec is ready for review.'),
    ],
    notes: [
      asked(
        'The spec is in `docs/specs/drain-retry-queues.md`:\n\n- Restore `RETRY_CONCURRENCY=8` on the worker and replay `webhook-retries`\n- Drop deliveries whose endpoint answers `410 Gone`, and record them as gone\n- `billing-retries` holds **87** jobs for invoices that are still open\n\nShould Implementation drain `billing-retries` too, or start with `webhook-retries`?',
      ),
      answered(MAYA, DRAIN_ANSWER, 6),
    ],
    output: 'Spec: restore concurrency, replay webhooks, drop 410 Gone.',
  },
  run_retries_3: {
    spend: null,
    before: `The spec in \`docs/specs/drain-retry-queues.md\` settled the change. Maya Chen answered: ${DRAIN_ANSWER}`,
    steps: [
      read('docs/specs/drain-retry-queues.md'),
      read('src/retries/deliver.ts'),
      edit(
        'src/retries/deliver.ts',
        'if (response.status >= 400) {\n  return retry(job);\n}',
        "if (response.status === 410) {\n  return drop(job, 'gone');\n}\nif (response.status >= 400) {\n  return retry(job);\n}",
      ),
      execute(
        'npm test -- retries',
        '1 failing: drops a delivery whose endpoint is gone\n  expected markGone to be called once',
        2,
        'failed',
      ),
      edit(
        'src/retries/drop.ts',
        'export const drop = (job: Job) => queue.remove(job.id);',
        'export const drop = async (job: Job, reason: DropReason) => {\n  await markGone(job.endpointId, reason);\n  await queue.remove(job.id);\n};',
      ),
      execute('npm test -- retries', 'running 14 tests', 2, 'running'),
    ],
    notes: [],
  },
  run_billing_1: {
    spend: spend(1.41, 6_020, 12_400, 894_000, 52_100),
    steps: [
      read('scripts/reconcile-invoices.ts', 2),
      thought(
        'Reconcile in a dry run first, so nothing is written until the totals match.',
      ),
      execute(
        'npm run reconcile -- --dry-run',
        'Error: connect ECONNREFUSED 10.0.4.12:5432\n    at TCPConnectWrap.afterConnect',
        2,
        'failed',
      ),
      said(
        'The reconcile script cannot reach the billing database from the runner.',
      ),
    ],
    notes: [
      failedWith(
        'The run exited before it finished: the reconcile script could not reach the billing database (`ECONNREFUSED 10.0.4.12:5432`).',
      ),
    ],
    output: 'Failed: the runner cannot reach the billing database.',
  },
  run_postgres_1: {
    spend: spend(0.74, 3_110, 7_020, 402_800, 30_900),
    steps: [
      read('package.json'),
      execute(
        'npm view pg versions --json | tail -3',
        '"8.12.0",\n"8.13.0",\n"8.13.1"',
        1,
      ),
      read('node_modules/pg/CHANGELOG.md', 2),
      thought(
        '8.13 returns `timestamptz` values with microseconds, so anything that compares stored timestamps as strings may change.',
      ),
      said(
        'Spec: move pg from 8.7.3 to 8.13.1 and drop the pg-native binding, which breaks the Alpine image build.',
      ),
    ],
    notes: [
      passed(
        'Passed to Implementation. Spec: move `pg` from 8.7.3 to 8.13.1 in acme/api and drop the `pg-native` binding, which breaks the Alpine image build. 8.13 keeps microseconds on `timestamptz`, so check what compares timestamps.',
      ),
    ],
    output: 'Spec: pg 8.13.1 without pg-native; watch timestamp precision.',
  },
  run_postgres_2: {
    spend: spend(2.31, 9_840, 21_600, 1_684_000, 88_200),
    before:
      'The spec asks for `pg` 8.13.1 in acme/api without the `pg-native` binding, and warns that `timestamptz` now keeps microseconds.',
    steps: [
      thought(
        'Start from the pool: the native binding is chosen there, and it is the part the spec drops.',
      ),
      read('src/db/pool.ts'),
      execute(
        'npm uninstall pg-native && npm install pg@8.13.1',
        'removed 4 packages, changed 3 packages in 6s',
        2,
      ),
      edit('package.json', PACKAGE_BEFORE, PACKAGE_AFTER, 1),
      edit('src/db/pool.ts', POOL_BEFORE, POOL_AFTER),
      execute(
        'npm test',
        '410 passed, 2 failed\n  invoices › keeps paid_at\n  exports › csv dates',
        4,
        'failed',
      ),
      edit('src/db/timestamps.ts', TIMESTAMPS_BEFORE, TIMESTAMPS_AFTER),
      edit(PAID_AT_MIGRATION, '', PAID_AT_SQL),
      execute(
        'npx tsc --noEmit',
        "src/invoices/invoice.repository.ts:27:24 - error TS2339: Property 'paid_at' does not exist on type 'QueryResultRow'.",
        2,
        'failed',
      ),
      edit('src/db/query.ts', QUERY_BEFORE, QUERY_AFTER),
      edit(
        'src/invoices/invoice.repository.ts',
        OPEN_INVOICES_BEFORE,
        OPEN_INVOICES_AFTER,
        1,
      ),
      execute('npm test', '412 passed', 5),
      execute(
        'gh pr create --repo acme/api --title "Upgrade the Postgres driver"',
        PULL_431,
        1,
      ),
      said(
        'Opened acme/api#431. All 412 tests pass. The migration rewrites `invoices.paid_at`, about 1.3M rows.',
      ),
    ],
    notes: [
      passed(
        `Opened [acme/api#431](${PULL_431}) and passed it to Code Review. All 412 tests pass after two fixes for the new timestamp precision; the migration \`0042_invoice_paid_at_precision\` rewrites \`invoices.paid_at\`, about 1.3M rows.`,
      ),
    ],
    output: 'Opened acme/api#431: pg 8.13.1 without pg-native.',
  },
  run_postgres_3: {
    spend: spend(0.38, 2_420, 4_880, 210_400, 18_200),
    steps: [
      execute('gh pr diff 431 --repo acme/api --stat', '', 1),
      read(PAID_AT_MIGRATION),
      execute(
        'psql $REPLICA_URL -c "select count(*) from invoices"',
        ' count\n-------\n 1312408',
        2,
      ),
      thought(
        'One ALTER over 1.3M rows holds an exclusive lock on invoices for the whole rewrite, about 40 seconds on the replica.',
      ),
      said(
        'The migration rewrites 1.3M invoice rows under one lock. Everything else looks safe to merge.',
      ),
    ],
    notes: [
      asked(
        `Reviewed [acme/api#431](${PULL_431}). The upgrade changes how \`timestamptz\` round-trips: values now keep microseconds. The migration \`0042_invoice_paid_at_precision\` rewrites **1.3M rows** of \`invoices\` under one lock, for about 40 seconds.\n\nIs it safe to approve, or should the rewrite run in batches outside the deploy?`,
      ),
    ],
    output: 'Reviewed acme/api#431: safe once the migration runs in batches.',
  },
  run_search_2: {
    spend: spend(1.86, 7_430, 17_900, 1_210_000, 70_400),
    steps: [
      execute(
        'psql -c "EXPLAIN ANALYZE SELECT ... WHERE title ILIKE \'%invoice%\'"',
        'Seq Scan on task  (actual time=0.03..1840.22 rows=212)',
        2,
      ),
      edit(TRIGRAM_MIGRATION, '', TRIGRAM_SQL),
      edit('src/search/workspace-search.ts', SEARCH_BEFORE, SEARCH_AFTER),
      execute('npm test -- search', '31 passing', 3),
      thought(SEARCH_SCAN_THOUGHT),
      execute(
        'gh pr create --repo acme/api --title "Search task titles with a trigram index"',
        PULL_412,
        1,
      ),
    ],
    notes: [
      passed(
        `Opened [acme/api#412](${PULL_412}). Search uses a trigram index on task titles now: 1.8 seconds down to 12 ms on the largest workspace.`,
      ),
    ],
    output: 'Opened acme/api#412: trigram index, 1.8 s down to 12 ms.',
  },
  run_search_3: {
    spend: spend(0.29, 2_010, 3_940, 162_000, 14_800),
    steps: [
      execute('gh pr diff 412 --repo acme/api --stat', '', 1),
      thought(
        'The migration builds the index concurrently, so it will not lock the table.',
      ),
      said('acme/api#412 is ready to merge.'),
    ],
    notes: [
      asked(
        `[acme/api#412](${PULL_412}) is ready. The index builds concurrently, so the migration takes no lock. Approve the merge?`,
      ),
      answered(SAM, 'Approved, merging.', 30),
    ],
    output: 'acme/api#412 is ready to merge.',
  },
  run_latency_1: {
    spend: null,
    steps: [
      execute(
        'grafana query "histogram_quantile(0.99, payments_api_latency)" --since 2h',
        'p99 860ms at 09:12, 410ms at 09:31, 905ms at 09:48',
        3,
      ),
      execute(
        'kubectl -n payments logs deploy/payments-api --since=1h | rg "pool"',
        'pg pool exhausted: 20 of 20 clients busy (x214)',
        2,
      ),
      thought(
        'The pool runs out under the 09:00 batch. Silencing the alert while the pool is resized stops the pages.',
        2,
      ),
      said(
        'The payments API runs out of database connections during the 09:00 batch.',
      ),
    ],
    notes: [
      asked('I need your approval before I use `grafana.silence`.', {
        form: 'approval',
        minutesIn: 12,
        approval: {
          kind: 'tool-call',
          name: 'grafana.silence',
          because: 'It mutes the alert for everyone on the on-call rotation.',
          inputs: [
            { name: 'alert', value: 'payments-api p99 > 800ms' },
            { name: 'for', value: '45m' },
            {
              name: 'comment',
              value:
                'Pool exhausted during the 09:00 batch. Resizing the pool from 20 to 40; silenced by Spotlight while it rolls out.',
            },
          ],
          standing: 'asked',
          edited: null,
          intent:
            'silence the p99 alert for 45 minutes while the connection pool is resized',
          askedOf: null,
        },
      }),
    ],
  },
  run_disk_1: {
    spend: spend(0.97, 4_480, 9_960, 640_200, 44_100),
    steps: [
      execute(
        'ssh worker-euw1-3 df -h /var',
        '/dev/nvme1n1  100G   94G  6G  94% /var',
        1,
      ),
      execute(
        'ssh worker-euw1-3 du -sh /var/log/worker /var/crash',
        '71G\t/var/log/worker\n14G\t/var/crash',
        2,
      ),
      read('infra/eu-west-1/worker.tfvars'),
      thought(
        'Debug logging is still on in eu-west-1. At 9 GB a day it fills the disk within a week of every resize.',
      ),
      said(DISK_DUMPS_SAID),
      said(
        'The worker logs grow 9 GB a day since debug logging was left on in eu-west-1.',
      ),
    ],
    notes: [
      approvalAsked(
        {
          kind: 'harness-permission',
          name: 'claude-code execute',
          because: 'The sre harness profile says to ask a person first.',
          inputs: [
            {
              name: 'title',
              value: 'ssh worker-euw1-3 sudo rm -f /var/crash/core.*',
            },
          ],
          standing: 'refused',
          edited: null,
          intent: null,
          askedOf: null,
        },
        30,
      ),
      decided(
        TOM,
        'Leave the dumps for now, I want to open one first. Mitigate can clear them.',
        33,
      ),
      passed(
        'Passed to Mitigate. Found it: `/var/log/worker` grows 9 GB a day since debug logging was left on in eu-west-1, and `/var/crash` holds 14 GB of core dumps that nothing rotates.',
      ),
    ],
    output: 'Debug logs at 9 GB a day and 14 GB of core dumps fill the disk.',
  },
  run_disk_2: {
    spend: spend(0.58, 2_960, 6_120, 344_000, 26_500),
    before:
      'Investigate found debug logging left on in eu-west-1 (9 GB a day) and 14 GB of core dumps in /var/crash.',
    steps: [
      edit(
        'infra/eu-west-1/worker.tfvars',
        'log_level = "debug"\n',
        'log_level = "info"\n',
      ),
      execute(
        'logrotate -f /etc/logrotate.d/worker && rm -f /var/crash/core.*',
        '',
        2,
      ),
      execute(
        'ssh worker-euw1-3 df -h /var',
        '/dev/nvme1n1  100G   38G  62G  38% /var',
        1,
      ),
      said('The eu-west-1 workers log at info again, and the disk is at 38%.'),
    ],
    notes: [
      asked(
        'The eu-west-1 workers log at `info` again and the disk is at 38%. Should I also add a disk alert at 80%?',
      ),
      answered(TOM, 'Yes, add the alert. Thanks.', 25),
    ],
    output: 'Logging back at info; disk at 38%.',
  },
  run_onboarding_1: {
    spend: spend(0.81, 3_480, 8_220, 498_000, 33_700),
    steps: [
      read('src/onboarding/Checklist.tsx'),
      execute(
        'metabase question 214 --since 30d',
        'first project within 24h: 41% (2,312 of 5,640 workspaces)',
        3,
      ),
      thought(
        'Most people stop at step four, inviting a teammate; a shorter list could move it to the end.',
      ),
      said(
        'Designed the experiment: four steps instead of seven, measured by first projects within 24 hours.',
      ),
    ],
    notes: [
      asked(
        'Experiment design:\n\n- **Change**: cut the onboarding checklist from 7 steps to 4, dropping invite a teammate, upload an avatar and pick a theme\n- **Metric**: share of new workspaces that create a first project within 24 hours, now **41%**\n- **Stop rule**: two weeks or 2,000 signups per arm, whichever comes first\n\nShould the shorter checklist still nudge people to invite a teammate later, or leave invites out entirely?',
      ),
    ],
    output: 'Experiment: four-step checklist, measured by first projects.',
  },
  run_pricing_1: {
    spend: spend(0.69, 2_980, 6_740, 388_000, 28_100),
    steps: [
      read('src/pricing/PlansPage.tsx'),
      execute('rg -n "annual" src/pricing', 'No matches.', 1),
      thought(
        'Show annual prices behind a toggle, defaulting to monthly so the control group sees no change.',
      ),
      edit(
        'docs/experiments/annual-pricing-toggle.md',
        '',
        '# Annual pricing toggle\n\n- Monthly by default; annual shows the monthly equivalent\n- Behind the `pricing_annual` flag\n- Metric: share of upgrades that pick annual\n',
      ),
      said(PRICING_FLAG_SAID),
    ],
    notes: [
      passed(
        'Passed to Build. The toggle defaults to monthly, shows annual prices with the monthly equivalent, and stays behind the `pricing_annual` flag until finance agrees the discount.',
      ),
    ],
    output: 'Annual toggle behind pricing_annual, monthly by default.',
  },
  run_pricing_2: {
    spend: null,
    before:
      'Design settled the toggle: monthly by default, behind the `pricing_annual` flag.',
    steps: [
      read('src/pricing/PlansPage.tsx'),
      edit(
        'src/pricing/PlansPage.tsx',
        '<PlanGrid plans={plans} period="month" />',
        '<BillingToggle value={period} onChange={setPeriod} />\n<PlanGrid plans={plans} period={period} />',
        2,
      ),
      execute('npm test -- pricing', '9 passing', 2),
      thought(
        'Invoice emails still print the monthly price. That is its own change, so file it rather than widen this one.',
      ),
    ],
    notes: [
      approvalAsked(
        {
          kind: 'tool-call',
          name: 'linear.issue-create',
          because:
            'Priya Nair asks to approve each call made with their Linear connection.',
          inputs: [
            {
              name: 'title',
              value: 'Show the annual price in invoice emails',
            },
            {
              name: 'description',
              value:
                'Plans bought on the annual toggle are invoiced yearly, but the invoice email still prints the monthly price. Found while building the toggle behind `pricing_annual`.',
            },
            { name: 'team', value: 'GRO' },
          ],
          standing: 'asked',
          edited: null,
          intent: 'file a follow-up issue for the invoice emails',
          askedOf: { id: PRIYA.id, name: PRIYA.name },
        },
        6,
      ),
    ],
  },
  run_survey_1: {
    spend: null,
    steps: [
      read('src/signup/Welcome.tsx'),
      execute(
        'metabase question 118 --since 30d',
        'signup source known: 22% (1,240 of 5,640 workspaces)',
        3,
      ),
      thought(
        'Only one signup in five says where it came from. One optional question on the welcome screen should not cost activation.',
      ),
      said(
        'Designed the experiment: one optional question on the welcome screen, measured by how many signups answer it.',
      ),
    ],
    notes: [
      approvalAsked(
        {
          kind: 'tool-call',
          name: 'linear.comment',
          because: 'It posts publicly on the issue, under the team’s name.',
          inputs: [
            {
              name: 'body',
              value:
                'Experiment design: one optional question on the welcome screen, “Where did you hear about Acme?”, with five choices and a free-text other. Metric: share of signups that answer, now 22%. Stop rule: two weeks or 1,000 signups per arm.',
            },
            { name: 'issue', value: 'GRO-131' },
          ],
          standing: 'asked',
          edited: null,
          intent: 'post the experiment design on GRO-131',
          askedOf: null,
        },
        6,
      ),
    ],
  },
  run_referral_1: {
    spend: spend(1.52, 6_420, 14_300, 980_000, 61_200),
    steps: [
      read('src/emails/invite.tsx'),
      edit('src/lib/referral.ts', '', REFERRAL_SOURCE),
      edit('src/emails/invite.tsx', INVITE_BEFORE, INVITE_AFTER),
      execute('npm test -- emails', '12 passing', 2),
      execute(
        'gh pr create --repo acme/web --title "Referral link in the invite email"',
        PULL_88,
        1,
      ),
    ],
    notes: [
      approvalAsked(
        {
          kind: 'tool-call',
          name: 'slack.post',
          because: 'It posts in a public channel, under the team’s name.',
          inputs: [
            { name: 'channel', value: '#growth' },
            {
              name: 'text',
              value:
                'Referral links are in invite emails for everyone with the `invite-referral` flag. Know someone who should try Acme? Your link is under Settings › Invite.',
            },
          ],
          standing: 'granted',
          edited: [
            { name: 'channel', value: '#growth' },
            {
              name: 'text',
              value:
                'Invite emails now carry the inviter’s referral link, for workspaces with the `invite-referral` flag. Your own link is under Settings › Invite.',
            },
          ],
          intent: 'tell #growth the referral link is live behind its flag',
          askedOf: null,
        },
        41,
      ),
      decided(PRIYA, '', 44),
      asked(
        `Opened [acme/web#88](${PULL_88}): the invite email carries the inviter’s referral link, behind the \`invite-referral\` flag. Should invitees who already have an account see it too?`,
      ),
      answered(PRIYA, 'No, only addresses we have never seen.', 50),
    ],
    output: 'Opened acme/web#88: referral link in the invite email.',
  },
};

export const PEOPLE_BY_ID: Record<string, TaskPersonResponseDto> = {
  [SAM.id]: SAM,
  [MAYA.id]: MAYA,
  [PRIYA.id]: PRIYA,
  [TOM.id]: TOM,
};

export const stepIndexOf = (runId: string, text: string): number =>
  RUN_STORIES[runId]?.steps.findIndex((step) => step.text === text) ?? -1;

export const groundStep = (runId: string, text: string, kind?: string) => {
  const index = stepIndexOf(runId, text);
  const step = RUN_STORIES[runId]?.steps[index];

  return {
    index,
    kind: kind ?? step?.kind ?? 'tool',
    text,
  };
};
