import type { ConfigChangeResponseDto } from '@/lib/api';

export const IMPLEMENTATION_ID = 'station_implementation';
export const STATION_ADDRESS = 'platform/delivery/implementation';
export const TESTS_FIRST_PULL_REQUEST =
  'https://github.com/acme/config/pull/58';

export const FINGERPRINTS = {
  tests: 'c4e19b07d2a85f3e6b1c90d7a4f2e8b5c3d1a9f7e5b3c1d9a7f5e3b1c9d7a5f3',
  effort: 'b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c93f2a9c1e',
  judge: '3f2a9c1e5b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9',
  first: '9a0d5e21c7b3f8e4a6d2c0b9e7f5a3d1c8b6e4f2a0d9c7b5e3f1a8d6c4b2e0f9',
  shorter: '5e1c7a93d2f4b6a8c0e2d4f6a8b0c2e4f6a8b0d2c4e6f8a0b2d4c6e8f0a2b4c6',
  medium: '7b2e4d6f8a0c1e3b5d7f9a1c3e5b7d9f0a2c4e6b8d0f1a3c5e7b9d2f4a6c8e0b',
  opus: 'e8c6a4f2d0b9e7c5a3f1d8b6e4c2a0f9d7b5e3c1a8f6d4b2e0c9a7f5d3b1e8c6',
  review: 'd1f3b5a7c9e2d4f6b8a0c3e5d7f9b1a4c6e8d0f2b5a7c9e1d3f6b8a0c2e4d7f9',
  haiku: 'a6c8e0b2d4f7a9c1e3b5d8f0a2c4e7b9d1f3a5c8e0b2d4f6a9c1e3b5d7f0a2c4',
} as const;

export const changed = (
  part: ConfigChangeResponseDto['part'],
  was: string | null = null,
  now: string | null = null,
  name: string | null = null,
): ConfigChangeResponseDto => ({ part, name, kind: 'changed', was, now });

export const added = (
  part: ConfigChangeResponseDto['part'],
  name: string,
): ConfigChangeResponseDto => ({
  part,
  name,
  kind: 'added',
  was: null,
  now: null,
});

type PastShape =
  | 'accepted'
  | 'passed'
  | 'sent-back'
  | 'failed'
  | 'stopped'
  | 'answered';

export type PastRun = {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly endedHoursAgo: number;
  readonly shape: PastShape;
  readonly visit?: number;
};

const past = (
  runId: string,
  taskId: string,
  title: string,
  endedHoursAgo: number,
  shape: PastShape,
  visit = 1,
): PastRun => ({ runId, taskId, title, endedHoursAgo, shape, visit });

export const IMPLEMENTATION_HISTORY: readonly PastRun[] = [
  past(
    'run_invoice_rounding_1',
    'task_invoice_rounding',
    'Round invoice totals per line item',
    34,
    'accepted',
  ),
  past(
    'run_refunds_2',
    'task_refunds',
    'Retry refunds on timeout',
    41,
    'accepted',
    2,
  ),
  past(
    'run_ledger_1',
    'task_ledger',
    'Backfill the ledger after the currency fix',
    52,
    'passed',
  ),
  past(
    'run_flaky_billing_3',
    'task_flaky_billing',
    'Fix the flaky billing test',
    60,
    'accepted',
    3,
  ),
  past(
    'run_flaky_billing_2',
    'task_flaky_billing',
    'Fix the flaky billing test',
    110,
    'sent-back',
    2,
  ),
  past(
    'run_invoice_split_1',
    'task_invoice_split',
    'Split the invoice job',
    120,
    'accepted',
  ),
  past(
    'run_billing_worker_1',
    'task_billing_worker',
    'Rename the billing worker',
    150,
    'accepted',
  ),
  past(
    'run_pricing_cache_1',
    'task_pricing_cache',
    'Warm the pricing cache on deploy',
    180,
    'failed',
  ),
  past(
    'run_webhook_docs_1',
    'task_webhook_docs',
    'Document the webhook retry policy',
    200,
    'accepted',
  ),
  past(
    'run_refunds_1',
    'task_refunds',
    'Retry refunds on timeout',
    230,
    'sent-back',
  ),
  past(
    'run_export_docs_1',
    'task_export_docs',
    'Write the invoice export guide',
    260,
    'accepted',
  ),
  past(
    'run_flaky_billing_1',
    'task_flaky_billing',
    'Fix the flaky billing test',
    290,
    'stopped',
  ),
  past(
    'run_dunning_1',
    'task_dunning',
    'Send dunning emails in the customer’s timezone',
    420,
    'sent-back',
  ),
  past('run_vat_1', 'task_vat', 'Show VAT on the invoice PDF', 470, 'accepted'),
  past(
    'run_coupons_1',
    'task_coupons',
    'Expire unused coupons nightly',
    530,
    'failed',
  ),
  past(
    'run_tax_ids_1',
    'task_tax_ids',
    'Validate EU tax ids at signup',
    580,
    'accepted',
  ),
  past(
    'run_payouts_csv_1',
    'task_payouts_csv',
    'Export payouts as CSV',
    650,
    'accepted',
  ),
  past(
    'run_proration_1',
    'task_proration',
    'Prorate plan changes mid-cycle',
    720,
    'sent-back',
  ),
  past(
    'run_receipts_1',
    'task_receipts',
    'Email receipts for refunds',
    800,
    'accepted',
  ),
  past(
    'run_webhook_signatures_1',
    'task_webhook_signatures',
    'Verify webhook signatures',
    900,
    'failed',
  ),
];

export type ConfigVersion = {
  readonly fingerprint: string;
  readonly since: number;
  readonly changes: readonly ConfigChangeResponseDto[];
  readonly pullRequest: string | null;
};

export const IMPLEMENTATION_VERSIONS: readonly ConfigVersion[] = [
  {
    fingerprint: FINGERPRINTS.tests,
    since: 66,
    changes: [changed('prompt')],
    pullRequest: TESTS_FIRST_PULL_REQUEST,
  },
  {
    fingerprint: FINGERPRINTS.effort,
    since: 312,
    changes: [
      changed('effort', 'medium', 'high'),
      added('skill', 'grafana-dashboards'),
    ],
    pullRequest: null,
  },
  {
    fingerprint: FINGERPRINTS.judge,
    since: 600,
    changes: [changed('judge', '0.1', '0.2', 'sample')],
    pullRequest: null,
  },
  {
    fingerprint: FINGERPRINTS.first,
    since: Number.POSITIVE_INFINITY,
    changes: [],
    pullRequest: null,
  },
];
