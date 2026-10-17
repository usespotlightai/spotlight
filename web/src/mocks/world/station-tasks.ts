type TaskNote = {
  readonly pass: string;
  readonly fail: string;
  readonly path: string;
};

const NOTES: Record<string, TaskNote> = {
  task_flaky_billing: {
    pass: 'Froze the payment sandbox clock, so the test no longer races its timeout.',
    fail: 'Raised the timeout instead of removing the race; the test still fails one run in ten.',
    path: 'services/billing/charge.test.ts',
  },
  task_invoice_split: {
    pass: 'Split the job per customer and kept every invoice total identical.',
    fail: 'Split the job but counted credit notes twice in the totals.',
    path: 'services/billing/invoice-job.ts',
  },
  task_billing_worker: {
    pass: 'Renamed the worker, its queue and the dashboards in one change.',
    fail: 'Missed the queue name in the deploy config, so the renamed worker would sit idle.',
    path: 'deploy/worker.yaml',
  },
  task_pricing_cache: {
    pass: 'Warms the cache from the deploy hook and skips it when the cache is fresh.',
    fail: 'Warms the cache on every request instead of once on deploy.',
    path: 'services/pricing/cache.ts',
  },
  task_refunds: {
    pass: 'Retries timed-out refunds with an idempotency key, so none is paid twice.',
    fail: 'Retries refunds without an idempotency key, so a slow refund can be paid twice.',
    path: 'services/billing/refunds.ts',
  },
  task_coupons: {
    pass: 'Expires unused coupons in a nightly job and leaves used ones alone.',
    fail: 'Expired coupons that customers had already applied to an open invoice.',
    path: 'services/billing/coupons.ts',
  },
  task_vat: {
    pass: 'Shows VAT per line and the total on the PDF, with the rate from the customer’s country.',
    fail: 'Shows VAT only on the total, not per line as the spec requires.',
    path: 'services/billing/invoice-pdf.ts',
  },
  task_webhook_docs: {
    pass: 'Documented the backoff, the five-try limit and the 410 Gone rule.',
    fail: 'Documented the old retry policy, before the five-try limit.',
    path: 'docs/webhooks/retries.md',
  },
  task_export_docs: {
    pass: 'Wrote the export guide with a worked example for each format.',
    fail: 'Left out the CSV column reference the spec requires.',
    path: 'docs/billing/exports.md',
  },
};

const FALLBACK: TaskNote = {
  pass: 'Did what the spec says and kept the tests passing.',
  fail: 'Left a check failing and did not say why.',
  path: 'src/index.ts',
};

const STATION_NOTES: Record<string, TaskNote> = {
  station_triage: {
    pass: 'Reproduced the report and named the failing path, with the request that triggers it.',
    fail: 'Could not reproduce the report and guessed at a cause instead of saying so.',
    path: 'services/api/errors.ts',
  },
  station_spec: {
    pass: 'Wrote a spec that lists what changes, what stays and how to test it.',
    fail: 'Left out what stays the same, so the spec reads as a rewrite.',
    path: 'docs/specs/README.md',
  },
  station_review: {
    pass: 'Flagged the one change that would break in production, on the line it is about.',
    fail: 'Approved the pull request without noticing the change it makes to a shared table.',
    path: 'services/api/src/index.ts',
  },
  station_investigate: {
    pass: 'Found the cause in the logs and quoted the lines it relies on.',
    fail: 'Blamed the last deploy without a log line to back it.',
    path: 'runbooks/alerts.md',
  },
  station_mitigate: {
    pass: 'Proposed the smallest change that stops the errors, with a way to roll it back.',
    fail: 'Proposed rewriting the retry logic when a config change would stop the errors.',
    path: 'infra/config/production.yaml',
  },
  station_design: {
    pass: 'Named the one change, the metric with today’s reading and a stop rule.',
    fail: 'Tested two changes at once, so the result could not say which one worked.',
    path: 'experiments/README.md',
  },
  station_build: {
    pass: 'Built the variant behind its flag and left the control untouched.',
    fail: 'Built the variant outside its flag, so every visitor would see it.',
    path: 'src/experiments/flags.ts',
  },
};

export const taskNote = (taskId: string, stationId?: string): TaskNote =>
  NOTES[taskId] ??
  (stationId ? STATION_NOTES[stationId] : undefined) ??
  FALLBACK;

export const knownTaskNote = (taskId: string): TaskNote | undefined =>
  NOTES[taskId];
