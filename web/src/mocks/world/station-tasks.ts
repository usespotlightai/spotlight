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

export const knownTaskNote = (taskId: string): TaskNote | undefined =>
  NOTES[taskId];
