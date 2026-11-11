import { WebInboxLinks } from '@notifications/infrastructure/links/web-inbox-links';
import { describe, expect, it } from 'vitest';

describe('WebInboxLinks', () => {
  it('links a task to its item in the inbox', () => {
    expect(new WebInboxLinks().pathTo('acme', 'task', 'task_1:0')).toBe(
      '/w/acme/inbox/task_1%3A0',
    );
  });

  it('links a notice to its own page', () => {
    expect(new WebInboxLinks().pathTo('acme', 'notice', 'ntc_1')).toBe(
      '/w/acme/inbox/notices/ntc_1',
    );
  });
});
