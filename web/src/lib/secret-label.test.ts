import { describe, expect, it } from 'vitest';
import { secretLabel } from '@/lib/secret-label';

describe('secretLabel', () => {
  it.each([
    ['SLACK_SIGNING_SECRET', 'slack', 'Signing secret'],
    ['SLACK_BOT_TOKEN', 'slack', 'Bot token'],
    ['PAGERDUTY_WEBHOOK_SECRET', 'pagerduty', 'Webhook secret'],
    ['GITHUB_API_KEY', 'slack', 'Github api key'],
  ])('names %s of %s as %s', (name, source, label) => {
    expect(secretLabel(name, source)).toBe(label);
  });
});
