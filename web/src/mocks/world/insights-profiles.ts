import type { ConfigChangeResponseDto } from '@/lib/api';
import type { PullRequestType } from '@/lib/insights-pull-requests';
import {
  DELIVERY_ID,
  EXPERIMENTS_ID,
  GROWTH_ID,
  INCIDENTS_ID,
  PLATFORM_ID,
} from '@/mocks/world';
import { HOUR_MS } from '@/mocks/world/insights-measures';
import {
  type ConfigVersion,
  FINGERPRINTS,
  IMPLEMENTATION_VERSIONS,
} from '@/mocks/world/station-history';

export const IMPLEMENTATION_ID = 'station_implementation';
const REVIEW_ID = 'station_review';

const REVIEW_BEFORE_COMMENTS =
  'c81e4f07a2d6b9e3f5a7c1d3e5b7a9f1c3e5d7b9a1f3c5e7d9b1a3f5c7e9d1b3';

export type Version = {
  readonly fingerprint: string;
  readonly sinceHoursAgo: number;
  readonly effort: string;
  readonly costPerRun: number;
  readonly sentBack: number;
  readonly failed: number;
  readonly checksFailed: number;
  readonly judge: number;
  readonly skills: readonly string[];
  readonly changes: readonly ConfigChangeResponseDto[];
};

type ServerUse = {
  readonly server: string;
  readonly share: number;
  readonly calls: number;
  readonly failure: number;
  readonly p50Ms: number;
  readonly dismissible: string | null;
};

export type Profile = {
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly harness: string;
  readonly model: string;
  readonly runningMs: number;
  readonly checks: boolean;
  readonly judged: boolean;
  readonly cacheReads: number;
  readonly failures: readonly string[];
  readonly uses: readonly (readonly [skill: string, share: number])[];
  readonly servers: readonly ServerUse[];
  readonly versions: readonly Version[];
};

const steady = (
  fingerprint: string,
  over: Partial<Version> & Pick<Version, 'effort' | 'costPerRun'>,
): Version => ({
  fingerprint,
  sinceHoursAgo: Number.POSITIVE_INFINITY,
  sentBack: 0.1,
  failed: 0.03,
  checksFailed: 0,
  judge: 0,
  skills: [],
  changes: [],
  ...over,
});

const linear = (
  share: number,
  calls: number,
  failure: number,
  dismissible: string | null,
): ServerUse => ({
  server: 'linear',
  share,
  calls,
  failure,
  p50Ms: 420,
  dismissible,
});

const sentry = (share: number, calls: number, failure: number): ServerUse => ({
  server: 'sentry',
  share,
  calls,
  failure,
  p50Ms: 880,
  dismissible: null,
});

const slack = (
  share: number,
  calls: number,
  failure: number,
  dismissible: string | null,
): ServerUse => ({
  server: 'slack',
  share,
  calls,
  failure,
  p50Ms: 150,
  dismissible,
});

type Behaviour = Omit<Version, 'fingerprint' | 'sinceHoursAgo' | 'changes'>;

const BEFORE_EFFORT: Behaviour = {
  effort: 'medium',
  costPerRun: 1.38,
  sentBack: 0.12,
  failed: 0.06,
  checksFailed: 0.16,
  judge: 0.6,
  skills: [],
};

const IMPLEMENTATION_BEHAVIOUR: Record<string, Behaviour> = {
  [FINGERPRINTS.first]: BEFORE_EFFORT,
  [FINGERPRINTS.judge]: { ...BEFORE_EFFORT, costPerRun: 1.41, sentBack: 0.13 },
  [FINGERPRINTS.effort]: {
    effort: 'high',
    costPerRun: 2.41,
    sentBack: 0.38,
    failed: 0.05,
    checksFailed: 0.11,
    judge: 0.56,
    skills: ['grafana-dashboards'],
  },
  [FINGERPRINTS.tests]: {
    effort: 'high',
    costPerRun: 2.18,
    sentBack: 0.12,
    failed: 0.04,
    checksFailed: 0.07,
    judge: 0.74,
    skills: ['grafana-dashboards'],
  },
};

const implementationVersionOf = (config: ConfigVersion): Version => ({
  ...(IMPLEMENTATION_BEHAVIOUR[config.fingerprint] ?? BEFORE_EFFORT),
  fingerprint: config.fingerprint,
  sinceHoursAgo: config.since,
  changes: config.changes,
});

const implementationVersions = (): Version[] =>
  [...IMPLEMENTATION_VERSIONS]
    .sort((one, other) => other.since - one.since)
    .map(implementationVersionOf);

const TURNS = 'The agent ran out of turns';
const CHECKS = 'Checks failed three times';
const LOST = 'The runner lost its connection';

const REVIEW_PROMPT_WAS = [
  '## Role',
  '',
  'Review the pull request on the task.',
  '',
  '- Flag what would break in production',
  '- Approve only what you would merge',
].join('\n');

const REVIEW_PROMPT_NOW = [
  '## Role',
  '',
  'Review the pull request on the task.',
  '',
  '- Flag what would break in production',
  '- Leave one comment per problem, on the line it is about',
  '- Approve only what you would merge',
].join('\n');

export const PROFILES: readonly Profile[] = [
  {
    teamId: PLATFORM_ID,
    lineId: DELIVERY_ID,
    stationId: 'station_triage',
    harness: 'claude-code',
    model: 'haiku',
    runningMs: 95_000,
    checks: false,
    judged: false,
    cacheReads: 0.9,
    failures: [TURNS],
    uses: [],
    servers: [linear(0.7, 2.4, 0.02, 'linear.issue-create')],
    versions: [
      steady(
        '5a1d7e93c0b4f8a26e1d9c37b5f08a4e2c6d91b3f7a05e8c4d2b96a1f3e7c50d',
        { effort: 'low', costPerRun: 0.16, failed: 0.04 },
      ),
    ],
  },
  {
    teamId: PLATFORM_ID,
    lineId: DELIVERY_ID,
    stationId: 'station_spec',
    harness: 'claude-code',
    model: 'opus',
    runningMs: 240_000,
    checks: false,
    judged: false,
    cacheReads: 1.7,
    failures: [TURNS, LOST],
    uses: [['release-notes', 0.04]],
    servers: [linear(0.8, 3.6, 0.03, 'linear.issue-create')],
    versions: [
      steady(
        '8c2e5b1f9d3a7c06e4b2d8f1a5c9e3b7d0f6a2c8e4b1d7f3a9c5e0b6d2f8a4c1',
        { effort: 'medium', costPerRun: 0.68, sentBack: 0.14, failed: 0.02 },
      ),
    ],
  },
  {
    teamId: PLATFORM_ID,
    lineId: DELIVERY_ID,
    stationId: IMPLEMENTATION_ID,
    harness: 'claude-code',
    model: 'sonnet',
    runningMs: 780_000,
    checks: true,
    judged: true,
    cacheReads: 2.6,
    failures: [CHECKS, CHECKS, TURNS],
    uses: [
      ['grafana-dashboards', 0.18],
      ['our-migrations', 0.22],
    ],
    servers: [linear(0.3, 1.5, 0.02, null), slack(0.1, 1, 0, null)],
    versions: implementationVersions(),
  },
  {
    teamId: PLATFORM_ID,
    lineId: DELIVERY_ID,
    stationId: REVIEW_ID,
    harness: 'codex',
    model: 'gpt-5',
    runningMs: 310_000,
    checks: false,
    judged: false,
    cacheReads: 1.2,
    failures: [LOST],
    uses: [['our-migrations', 0.05]],
    servers: [],
    versions: [
      steady(REVIEW_BEFORE_COMMENTS, {
        effort: 'medium',
        costPerRun: 0.44,
        sentBack: 0.15,
        failed: 0.02,
      }),
      {
        fingerprint: FINGERPRINTS.review,
        sinceHoursAgo: 9 * 24,
        effort: 'medium',
        costPerRun: 0.47,
        sentBack: 0.2,
        failed: 0.02,
        checksFailed: 0,
        judge: 0,
        skills: [],
        changes: [
          {
            part: 'prompt',
            name: null,
            kind: 'changed',
            was: REVIEW_PROMPT_WAS,
            now: REVIEW_PROMPT_NOW,
          },
        ],
      },
    ],
  },
  {
    teamId: PLATFORM_ID,
    lineId: INCIDENTS_ID,
    stationId: 'station_investigate',
    harness: 'claude-code',
    model: 'sonnet',
    runningMs: 420_000,
    checks: false,
    judged: false,
    cacheReads: 2.1,
    failures: [TURNS, LOST],
    uses: [['grafana-dashboards', 0.72]],
    servers: [sentry(0.9, 2.3, 0.22), slack(0.4, 1.2, 0, null)],
    versions: [
      steady(
        '1f9b3d7a5c0e8b2d6f4a1c9e7b3d5f0a8c2e6b4d1f7a3c9e5b0d8f2a6c4e1b37',
        {
          effort: 'high',
          costPerRun: 0.92,
          sentBack: 0.1,
          failed: 0.05,
          skills: ['grafana-dashboards'],
        },
      ),
    ],
  },
  {
    teamId: PLATFORM_ID,
    lineId: INCIDENTS_ID,
    stationId: 'station_mitigate',
    harness: 'claude-code',
    model: 'sonnet',
    runningMs: 260_000,
    checks: false,
    judged: false,
    cacheReads: 1.4,
    failures: [LOST],
    uses: [],
    servers: [sentry(0.5, 1.4, 0.18), slack(0.6, 1, 0, null)],
    versions: [
      steady(
        '6d0a4e8c2b9f1d5a7c3e0b8d4f6a2c9e1b5d7f3a0c8e4b2d6f9a1c5e3b7d0f84',
        { effort: 'medium', costPerRun: 0.51, sentBack: 0.08, failed: 0.03 },
      ),
    ],
  },
  {
    teamId: GROWTH_ID,
    lineId: EXPERIMENTS_ID,
    stationId: 'station_design',
    harness: 'claude-code',
    model: 'opus',
    runningMs: 300_000,
    checks: false,
    judged: false,
    cacheReads: 1.5,
    failures: [TURNS],
    uses: [['experiment-briefs', 0.55]],
    servers: [linear(0.6, 2, 0.02, null)],
    versions: [
      steady(
        '9e7c5a3f1d0b8e6c4a2f9d7b5e3c1a0f8d6b4e2c9a7f5d3b1e0c8a6f4d2b9e15',
        { effort: 'medium', costPerRun: 0.74, sentBack: 0.15, failed: 0.02 },
      ),
    ],
  },
  {
    teamId: GROWTH_ID,
    lineId: EXPERIMENTS_ID,
    stationId: 'station_build',
    harness: 'claude-code',
    model: 'sonnet',
    runningMs: 900_000,
    checks: true,
    judged: false,
    cacheReads: 2.3,
    failures: [CHECKS, TURNS],
    uses: [],
    servers: [],
    versions: [
      steady(
        '2b8d4f6a0c3e9b1d7f5a2c8e4b0d6f3a9c1e7b5d2f8a4c0e6b3d9f1a7c5e2b86',
        {
          effort: 'high',
          costPerRun: 1.1,
          sentBack: 0.2,
          failed: 0.05,
          checksFailed: 0.12,
        },
      ),
    ],
  },
];

export const profileOf = (stationId: string): Profile | undefined =>
  PROFILES.find((each) => each.stationId === stationId);

const versionStartOf = (version: Version): number =>
  Date.now() - version.sinceHoursAgo * HOUR_MS;

export const versionAt = (profile: Profile, at: number): Version =>
  [...profile.versions].reverse().find((each) => versionStartOf(each) <= at) ??
  (profile.versions[0] as Version);

export type Titled = readonly [title: string, type: PullRequestType];

export const DELIVERY_TITLES: readonly Titled[] = [
  ['Paginate the audit log export', 'feature'],
  ['Fix double charge when a card retry races the webhook', 'fix'],
  ['Move invoice rendering off the request path', 'refactor'],
  ['Cover the refund flow with integration tests', 'tests'],
  ['Add an idempotency key to POST /payments', 'feature'],
  ['Stop the worker from re-queuing poisoned jobs', 'fix'],
  ['Expire stale sessions after a password reset', 'fix'],
  ['Bump the Stripe SDK to v14', 'chore'],
  ['Return 429 with Retry-After from the public API', 'feature'],
  ['Split the notifications worker by channel', 'refactor'],
  ['Fix timezone drift in the weekly usage report', 'fix'],
  ['Add a dry-run flag to the data backfill', 'feature'],
  ['Test the webhook signature check against replays', 'tests'],
  ['Drop the unused legacy_plans table', 'chore'],
  ['Retry failed uploads in parts', 'feature'],
  ['Fix the CSV export cutting rows at 10,000', 'fix'],
  ['Cache plan lookups per request', 'refactor'],
  ['Log the request id on every worker job', 'chore'],
  ['Allow partial refunds from the admin API', 'feature'],
  ['Fix the session cookie on Safari', 'fix'],
  ['Extract the pricing rules into one module', 'refactor'],
  ['Cover the dunning schedule with tests', 'tests'],
  ['Send a receipt email after a plan change', 'feature'],
  ['Fix a race in the job lock renewal', 'fix'],
  ['Add an index for invoices by customer and status', 'chore'],
  ['Show the next billing date in GET /subscriptions', 'feature'],
  ['Stop logging card fingerprints', 'fix'],
  ['Move the cron schedules into config', 'refactor'],
  ['Verify the worker drains on SIGTERM', 'tests'],
  ['Add webhook delivery attempts to the API', 'feature'],
  ['Fix the 500 on an empty search query', 'fix'],
  ['Replace the hand-rolled retry with the queue backoff', 'refactor'],
  ['Upgrade the Node base image to 22', 'chore'],
  ['Filter invoices by date range', 'feature'],
  ['Fix the stuck export when a column is renamed', 'fix'],
  ['Test the rate limiter under bursty traffic', 'tests'],
  ['Add a health check for the queue consumer', 'feature'],
  ['Fix a memory leak in the PDF renderer', 'fix'],
  ['Inline the old feature flag for EU invoicing', 'refactor'],
  ['Expose the customer balance in the API', 'feature'],
  ['Fix rounding on prorated upgrades', 'fix'],
  ['Remove the v1 webhook endpoints', 'chore'],
  ['Add tracing spans around the payment provider calls', 'feature'],
  ['Fix the duplicate welcome email after SSO sign-up', 'fix'],
  ['Cover the coupon stacking rules with tests', 'tests'],
  ['Batch the nightly usage aggregation', 'refactor'],
  ['Add a reason to manual credit notes', 'feature'],
  ['Fix the worker crash on an empty payload', 'fix'],
];

export const INCIDENT_TITLES: readonly Titled[] = [
  ['Checkout error rate above 2%', 'fix'],
  ['Queue depth alert on the email worker', 'fix'],
  ['Replica lag on the reporting database', 'fix'],
  ['Elevated 502s from the API gateway', 'fix'],
  ['Disk at 90% on the search nodes', 'fix'],
  ['Webhook deliveries timing out for one partner', 'fix'],
  ['Cron job for invoices did not run', 'fix'],
  ['Spike in failed logins from one ASN', 'fix'],
  ['Payments provider latency above SLO', 'fix'],
  ['Memory pressure on the worker pods', 'fix'],
];

export const EXPERIMENT_TITLES: readonly Titled[] = [
  ['Test a one-step sign-up form', 'feature'],
  ['Show annual savings on the plans page', 'feature'],
  ['Try a usage meter in the sidebar', 'feature'],
  ['Test social proof on the pricing page', 'feature'],
  ['Nudge trial users on day five', 'feature'],
  ['Simplify the empty dashboard', 'feature'],
  ['Test a shorter cancellation flow', 'feature'],
  ['Try templates in the first project', 'feature'],
  ['Fix the experiment flag leaking to admins', 'fix'],
  ['Clean up the finished pricing experiments', 'chore'],
];
