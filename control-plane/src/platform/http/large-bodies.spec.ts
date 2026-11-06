import { takesLargeBody } from '@platform/http/large-bodies';
import { describe, expect, it } from 'vitest';

describe('takesLargeBody', () => {
  it.each([
    '/api/runs/r1/events',
    '/api/runs/r1/completion',
    '/api/runs/r1/tools/github.comment',
    '/api/runs/r1/change-stacks',
    '/api/runs/r1/change-stack-checks/s1',
    '/api/webhooks/github',
    '/api/webhooks/w/acme/t/ENG/slack',
    '/api/terraform/workspaces/acme/states/default',
  ])('takes a large body on POST %s', (path) => {
    expect(takesLargeBody('POST', path)).toBe(true);
  });

  it.each([
    ['GET', '/api/runs/r1/change-stacks'],
    ['POST', '/api/runs/r1/messages/ack'],
    ['POST', '/api/runs/r1/events/extra'],
    ['POST', '/api/v1/resources/skills'],
    ['POST', '/runs/r1/events'],
  ])('keeps the default limit on %s %s', (method, path) => {
    expect(takesLargeBody(method, path)).toBe(false);
  });
});
