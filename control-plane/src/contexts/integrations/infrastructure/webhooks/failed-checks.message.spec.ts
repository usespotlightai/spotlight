import type { FailedCheck } from '@github/application/dto/pull-request-activity.dto';
import { failedChecksMessage } from '@integrations/infrastructure/webhooks/failed-checks.message';
import { describe, expect, it } from 'vitest';

const check = (over: Partial<FailedCheck> = {}): FailedCheck => ({
  name: 'web',
  step: null,
  summary: null,
  log: null,
  ...over,
});

describe('failedChecksMessage', () => {
  it('says nothing when no check is named', () => {
    expect(failedChecksMessage([])).toBeNull();
  });

  it('names only the checks when it knows nothing more', () => {
    expect(failedChecksMessage([check(), check({ name: 'gitleaks' })])).toBe(
      'Failed: web, gitleaks.',
    );
  });

  it('gives the failed step even without a log', () => {
    expect(failedChecksMessage([check({ step: 'React Doctor' })])).toBe(
      'Failed: web.\n\n**web** failed at the step "React Doctor".',
    );
  });

  it('gives the summary of a check that is not an Actions job', () => {
    expect(
      failedChecksMessage([
        check({
          name: 'CodeQL',
          summary: '1 new alert\n\nUse of a weak hash.',
        }),
      ]),
    ).toBe(
      'Failed: CodeQL.\n\n**CodeQL** failed.\n\n1 new alert\n\nUse of a weak hash.',
    );
  });

  it('keeps only the last 40 lines of a log', () => {
    const log = Array.from({ length: 100 }, (_, at) => `line ${at}`).join('\n');
    const body = failedChecksMessage([check({ log })]) ?? '';

    expect(body).toContain('line 99');
    expect(body).toContain('line 60');
    expect(body).not.toContain('line 59\n');
  });

  it('keeps only the start of a long summary', () => {
    const summary = 'x'.repeat(5_000);
    const body = failedChecksMessage([check({ summary })]) ?? '';

    expect(body).toContain('x'.repeat(2_000));
    expect(body).not.toContain('x'.repeat(2_001));
  });

  it('gives details of the first five checks and names the others', () => {
    const checks = Array.from({ length: 7 }, (_, at) =>
      check({ name: `job ${at}`, step: 'Test' }),
    );
    const body = failedChecksMessage(checks) ?? '';

    expect(body).toContain(
      'Failed: job 0, job 1, job 2, job 3, job 4, job 5, job 6.',
    );
    expect(body).toContain('**job 4** failed at the step');
    expect(body).not.toContain('**job 5**');
  });

  it('fences a log that has fences of its own', () => {
    expect(failedChecksMessage([check({ log: '```js\nx\n```' })])).toBe(
      'Failed: web.\n\n**web** failed. The end of its log:\n\n````text\n```js\nx\n```\n````',
    );
  });
});
